const express = require("express");
const bodyParser = require("body-parser");
const twilio = require("twilio");
const { MessagingResponse } = require("twilio").twiml;

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));

// In-memory session tracking
const userSessions = {};

// Twilio Credentials 
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

app.get("/", async(req, res) => {
    res.send("Hello! This is the Twilio WhatsApp NDA Bot. Send 'Hy' to start.");    
});

//get route to redirect the user to whatsapp
app.get("/" , (req, res) => {

});

// Webhook for incoming WhatsApp messages
app.post("/whatsapp", async (req, res) => {
    const twiml = new MessagingResponse();
    const from = req.body.From;
    const message = req.body.Body.trim();

    if (!userSessions[from]) {
        userSessions[from] = { step: 0, data: {} };
    }
    const session = userSessions[from];

    try {
        switch (session.step) {
            case 0:
                if (message.toLowerCase() === "hy") {
                    twiml.message("Hello! Do you want to create an NDA? Reply 'Yes' to proceed.");
                    session.step = 1;
                } else {
                    twiml.message("Please reply with 'Hy' to start the NDA process.");
                }
                break;

            case 1:
                if (message.toLowerCase() === "yes") {
                    twiml.message("Great! Let's begin. Please enter 'Party 1 Name':");
                    session.step = 2;
                } else {
                    twiml.message("Please reply with 'Yes' to proceed.");
                }
                break;

            case 2:
                if (/^[a-zA-Z ]+$/.test(message)) {
                    session.data.party1 = message;
                    twiml.message("Now, please enter 'Party 2 Name':");
                    session.step = 3;
                } else {
                    twiml.message("Please enter a valid name (letters and spaces only).");
                }
                break;

            case 3:
                if (/^[a-zA-Z ]+$/.test(message)) {
                    session.data.party2 = message;
                    twiml.message("Enter the 'Agreement Date' (YYYY-MM-DD):");
                    session.step = 4;
                } else {
                    twiml.message("Please enter a valid name (letters and spaces only).");
                }
                break;

            case 4:
                if (/^\d{4}-\d{2}-\d{2}$/.test(message)) {
                    session.data.agreementDate = message;
                    twiml.message("Describe the 'Confidentiality Terms':");
                    session.step = 5;
                } else {
                    twiml.message("Invalid date format. Please enter the date as YYYY-MM-DD.");
                }
                break;

            case 5:
                if (message.length > 10) {
                    session.data.confidentialityTerms = message;
                    twiml.message("Enter 'Duration of Agreement' (e.g., 2 years):");
                    session.step = 6;
                } else {
                    twiml.message("Please provide more detailed confidentiality terms (at least 10 characters).");
                }
                break;

            case 6:
                if (/^\d+ (year|years|month|months)$/.test(message)) {
                    session.data.duration = message;
                    twiml.message("Optional: Enter 'Governing Law' (or type 'Skip' to continue):");
                    session.step = 7;
                } else {
                    twiml.message("Invalid format. Use formats like '2 years' or '6 months'.");
                }
                break;

            case 7:
                session.data.governingLaw = message.toLowerCase() !== "skip" ? message : "Not specified";

                twiml.message(
                    `✅ NDA Details:\n\nParty 1: ${session.data.party1}\nParty 2: ${session.data.party2}\nDate: ${session.data.agreementDate}\nTerms: ${session.data.confidentialityTerms}\nDuration: ${session.data.duration}\nGoverning Law: ${session.data.governingLaw}\n\nReply 'Confirm' to finalize and receive PDF.`
                );
                session.step = 8;
                break;

            case 8:
                if (message.toLowerCase() === "confirm") {


                    // Generate NDA PDF inline here
                    const PDFDocument = require("pdfkit");
                    const fs = require("fs");
                    const fileName = `./nda_${Date.now()}.pdf`;
                    const doc = new PDFDocument();
                    const writeStream = fs.createWriteStream(fileName);
                    doc.pipe(writeStream);

                    doc.fontSize(20).text("Non-Disclosure Agreement", { align: "center" });
                    doc.moveDown();
                    doc.fontSize(12).text(`Date: ${session.data.agreementDate}`);
                    doc.moveDown();
                    doc.text(`This Agreement is made between:`);
                    doc.text(`- Party 1: ${session.data.party1}`);
                    doc.text(`- Party 2: ${session.data.party2}`);
                    doc.moveDown();
                    doc.text(`Confidentiality Terms:\n${session.data.confidentialityTerms}`);
                    doc.moveDown();
                    doc.text(`Duration: ${session.data.duration}`);
                    doc.moveDown();
                    doc.text(`Governing Law: ${session.data.governingLaw}`);
                    doc.end();

                    writeStream.on("finish", async () => {
                        try {
                            // Upload PDF to Twilio and send via WhatsApp
                            const media = await client.messages.create({
                                from: 'whatsapp:+14155238886',
                                to: from,
                                body: "🎉 Here's your NDA document (PDF).",
                                mediaUrl: [` https://99c9-103-159-214-186.ngrok-free.app/nda/${fileName.split('/').pop()}`] // You must serve this file publicly
                            });

                            console.log("Media sent:", media.sid);
                        } catch (sendError) {
                            console.error("Failed to send PDF via WhatsApp:", sendError.message);
                            twiml.message("PDF creation succeeded but sending failed. Try again later.");
                        }
                    });

                    twiml.message("Creating your NDA document... Please wait a moment.");
                    delete userSessions[from];
                } else {
                    twiml.message("Type 'Confirm' to receive the NDA PDF or restart with 'Hy'.");
                }
                break;

            default:
                twiml.message("Please follow the steps. Type 'Hy' to restart.");
        }
    } catch (error) {
        console.error("Error:", error.message);
        twiml.message("Oops! Something went wrong. Please try again later.");
    }

    res.type("text/xml").send(twiml.toString());
});


// Start Express Server
app.listen(3000, () => {
    console.log("Express server listening on port 3000");
});
