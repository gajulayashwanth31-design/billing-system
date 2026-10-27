const path = require("path");
const https = require("https");
const querystring = require("querystring");
require("dotenv").config({
  path: path.join(__dirname, "..", ".env"),
  quiet: true,
});

const { normalizeIndianPhone } = require("../src/services/whatsapp/phone");

const delay = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

function twilioRequest(url, authorization, { method = "GET", data } = {}) {
  const body = data ? querystring.stringify(data) : "";
  return new Promise((resolve, reject) => {
    const request = https.request(
      url,
      {
        method,
        headers: {
          Authorization: authorization,
          Accept: "application/json",
          ...(data
            ? {
                "Content-Type": "application/x-www-form-urlencoded",
                "Content-Length": Buffer.byteLength(body),
              }
            : {}),
        },
      },
      (response) => {
        let responseBody = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          responseBody += chunk;
        });
        response.on("end", () => {
          let parsedBody;
          try {
            parsedBody = JSON.parse(responseBody);
          } catch {
            reject(new Error("Twilio returned a non-JSON response"));
            return;
          }
          resolve({ status: response.statusCode || 0, body: parsedBody });
        });
      },
    );
    request.on("error", reject);
    if (data) request.write(body);
    request.end();
  });
}

function explainFailure(error) {
  const message = String(error.message || error);
  const code = String(error.code || "");
  if (/credentials are incomplete|TWILIO_ACCOUNT_SID/.test(message)) {
    return "Twilio credentials are missing. Fill the three TWILIO_* values in backend/.env.";
  }
  if (code === "20003" || /authenticate|authentication/i.test(message)) {
    return "Twilio rejected the credentials. Check Account SID and Auth Token in backend/.env.";
  }
  if (
    code === "21654" ||
    /ContentSid Required/i.test(message)
  ) {
    return "Twilio returned 21654 even though this direct test sends only To, From, and Body. The request was rejected before a message was created. Confirm the Twilio Console is showing the same project/account configured in backend/.env, then check Monitor → Debugger for this time.";
  }
  if (
    code === "63016" ||
    /outside.*24.?hour|template required/i.test(message)
  ) {
    return "Twilio needs an open 24-hour WhatsApp reply window for a plain text. From your joined phone, send a normal message such as 'Hi' to the Twilio Sandbox number, then rerun this test within 24 hours. Outside that window, WhatsApp requires an approved template.";
  }
  if (code === "63015" || /join|sandbox/i.test(message)) {
    return "The destination may not have joined the WhatsApp Sandbox. Send its current 'join <code>' message from that phone; membership expires after 72 hours.";
  }
  if (
    code === "21608" ||
    code === "21614" ||
    /phone number must be a valid|invalid.*number|not a valid/i.test(message)
  ) {
    return "The destination number is invalid or not enabled for WhatsApp. Use a valid +91 mobile number that has joined the sandbox.";
  }
  return `WhatsApp test failed: ${message}`;
}

async function main() {
  if (process.env.WHATSAPP_PROVIDER !== "twilio") {
    throw new Error(
      "Set WHATSAPP_PROVIDER=twilio in backend/.env to send a real test message.",
    );
  }
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM } =
    process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_WHATSAPP_FROM) {
    throw new Error(
      "Twilio credentials are incomplete. Fill TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_WHATSAPP_FROM in backend/.env.",
    );
  }
  const phone = normalizeIndianPhone(process.argv[2]);
  process.stdout.write(
    "Sending a plain WhatsApp text directly to Twilio's Messages API with only To, From, and Body.\n",
  );
  const accountUrl = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(TWILIO_ACCOUNT_SID)}/Messages.json`;
  const authorization = `Basic ${Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64")}`;
  const response = await twilioRequest(accountUrl, authorization, {
    method: "POST",
    data: {
      From: TWILIO_WHATSAPP_FROM,
      To: `whatsapp:${phone}`,
      Body: "Ledgerline WhatsApp test message.",
    },
  });
  const message = response.body;
  if (response.status < 200 || response.status >= 300) {
    throw Object.assign(
      new Error(message.message || `Twilio API returned HTTP ${response.status}`),
      {
        code: message.code,
        moreInfo: message.more_info,
        status: response.status,
      },
    );
  }
  process.stdout.write(
    `Twilio accepted the message request (SID: ${message.sid}, status: ${message.status || "unknown"}).\n`,
  );

  let latestStatus;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const statusResponse = await twilioRequest(
      accountUrl.replace(
        /\.json$/,
        `/${encodeURIComponent(message.sid)}.json`,
      ),
      authorization,
    );
    const statusMessage = statusResponse.body;
    if (statusResponse.status < 200 || statusResponse.status >= 300) {
      throw Object.assign(
        new Error(
          statusMessage.message ||
            `Twilio status lookup returned HTTP ${statusResponse.status}`,
        ),
        {
          code: statusMessage.code,
          moreInfo: statusMessage.more_info,
          status: statusResponse.status,
        },
      );
    }
    latestStatus = {
      status: statusMessage.status,
      errorCode: statusMessage.error_code,
      errorMessage: statusMessage.error_message,
    };
    if (["delivered", "read", "failed", "undelivered"].includes(latestStatus.status)) {
      break;
    }
    if (attempt < 9) await delay(3000);
  }

  if (latestStatus.status === "delivered" || latestStatus.status === "read") {
    process.stdout.write(
      `Twilio reports ${latestStatus.status}; this confirms delivery to WhatsApp, but not that you personally saw it.\n`,
    );
  } else if (
    latestStatus.status === "failed" ||
    latestStatus.status === "undelivered"
  ) {
    throw Object.assign(
      new Error(
        latestStatus.errorMessage ||
          `Twilio reports message status "${latestStatus.status}".`,
      ),
      { code: latestStatus.errorCode || undefined },
    );
  } else {
    process.stdout.write(
      `Delivery is not confirmed yet (latest Twilio status: ${latestStatus.status || "unknown"}). Check the message SID in Twilio Console → Monitor → Logs → Messaging.\n`,
    );
  }
}

main()
  .catch((error) => {
    console.error(explainFailure(error));
    if (error.code || error.message) {
      console.error(
        `Twilio detail${error.code ? ` (${error.code})` : ""}: ${error.message || "No additional message"}`,
      );
    }
    if (error.moreInfo) {
      console.error(`Twilio help: ${error.moreInfo}`);
    }
    if (error.status) {
      console.error(`Twilio HTTP status: ${error.status}`);
    }
    if (error.code === 21654) {
      console.error(
        "This script's direct REST request contains no ContentVariables parameter. If this repeats, check that the Twilio Console project matches TWILIO_ACCOUNT_SID in backend/.env; do not share the SID or token.",
      );
    }
    process.exitCode = 1;
  });
