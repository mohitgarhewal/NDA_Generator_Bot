const express = require("express");
const bodyParser = require("body-parser");
const twilio = require("twilio");
const path = require('path');
const { MessagingResponse } = require("twilio").twiml;

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.set('view engine', 'ejs');
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/nda', express.static(path.join(__dirname, 'public')));


// In-memory session tracking
const userSessions = {};

// Twilio Credentials 
const accountSid = "AC7302bd9281c1eafa8eac9a977bc22958";
const authToken = "603582207dc8f18ee0091c693328d9c4";
const client = twilio(accountSid, authToken);



//get route to redirect the user to whatsapp
app.get("/", async(req, res) => {
    console.log("Landing page accessed");
    // Render the landing page
    res.render("landing_page");    
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
                    twiml.message("Welcome to the NDA Generator Bot! How can I assist you today?\n 1. Create New NDA \n 2. View Last NDA ");
                    console.log("Welcome to the NDA Generator Bot! How can I assist you today?\n 1. Create New NDA \n 2. View Last NDA ");                    
                    session.step = 1;
                } else {
                    twiml.message("Please reply with 'Hy' to start the NDA process.");
                }
                break;

            case 1:
                if (message.toLowerCase() === "1" || message.toLowerCase() === "Create"  ) {
                    twiml.message("Great! Let's begin. Please enter 'Party 1 Name':");
                   console.log("Great! Let's begin. Please enter 'Party 1 Name':");
                   
                    session.step = 2;
                }  else if (message.toLowerCase() === "2" || message.toLowerCase() === "view") {
                    const fs = require("fs");
                    const path = require("path");
                    const phone = from.split(":")[1];
                    const publicFolder = "./public";
                
                    // Get all NDA files for this number
                    const files = fs.readdirSync(publicFolder)
                        .filter(file => file.endsWith(`_${phone}.pdf`))
                        .sort((a, b) => {
                            const aTime = parseInt(a.split("_")[1]);
                            const bTime = parseInt(b.split("_")[1]);
                            return bTime - aTime; // latest first
                        });
                
                    if (files.length > 0) {
                        const latestFile = files[0];
                        const publicUrl = `https://d1cc-103-159-214-186.ngrok-free.app/nda/${latestFile}`;
                
                        await client.messages.create({
                            from: 'whatsapp:+14155238886',
                            to: from,
                            body: "📄 Here's your last NDA document.",
                            mediaUrl: [publicUrl]
                        });
                        twiml.message("Sent your last NDA document ✅");
                    } else {
                        twiml.message("❌ No NDA found for your number. Please generate one by replying with '1'.");
                    }
                } else {
                    twiml.message("Invalid option. Please reply with '1' to create a new NDA or '2' to view the last NDA.");
                }
                
                break;

            case 2:
                if (/^[a-zA-Z ]+$/.test(message)) {
                    session.data.party1 = message;
                   twiml.message("Now, please enter 'Party 2 Name':");
                   console.log("Now, please enter 'Party 2 Name':");
                    session.step = 3;
                } else {
                    twiml.message("Please enter a valid name (letters and spaces only).");
                }
                break;

            case 3:
                if (/^[a-zA-Z ]+$/.test(message)) {
                    session.data.party2 = message;
                    twiml.message("Enter the 'Agreement Date' (YYYY-MM-DD):");
                    console.log("Enter the 'Agreement Date' (YYYY-MM-DD):");
                    session.step = 4;
                } else {
                    twiml.message("Please enter a valid name (letters and spaces only).");
                }
                break;

            case 4:
                if (/^\d{4}-\d{2}-\d{2}$/.test(message)) {
                    session.data.agreementDate = message;
                    twiml.message("Describe the 'Confidentiality Terms':");
                    console.log("Describe the 'Confidentiality Terms':");
                    session.step = 5;
                } else {
                    twiml.message("Invalid date format. Please enter the date as YYYY-MM-DD.");
                }
                break;

            case 5:
                if (message.length > 7) {
                    session.data.confidentialityTerms = message;
                    twiml.message("Enter 'Duration of Agreement' (e.g., 2 years):");
                    console.log("Enter 'Duration of Agreement' (e.g., 2 years):");
                    session.step = 6;
                } else {
                    twiml.message("Please provide more detailed confidentiality terms (at least 10 characters).");
                }
                break;

            case 6:
                if (/^\d+ (year|years|month|months)$/.test(message)) {
                    session.data.duration = message;
                    twiml.message("Optional: Enter 'Governing Law' (or type 'Skip' to continue):");
                    console.log("Optional: Enter 'Governing Law' (or type 'Skip' to continue):");
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
                console.log(`✅ NDA Details:\n\nParty 1: ${session.data.party1}\nParty 2: ${session.data.party2}\nDate: ${session.data.agreementDate}\nTerms: ${session.data.confidentialityTerms}\nDuration: ${session.data.duration}\nGoverning Law: ${session.data.governingLaw}\n\nReply 'Confirm' to finalize and receive PDF.`);
                session.step = 8;
                break;

            case 8:
                if (message.toLowerCase() === "confirm") {


                    // Generate NDA PDF inline here
                    const PDFDocument = require("pdfkit");
                    const fs = require("fs");
                    const phone = from.split(":")[1];
                    const timestamp = Date.now();
                    const fileName = `nda_${timestamp}_${phone}.pdf`;
                    const doc = new PDFDocument();
                    const writeStream = fs.createWriteStream('./public/'+fileName);
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
                            //console.log(`https://912f-103-159-214-186.ngrok-free.app/nda/${fileName}`);
                            
                            const media = await client.messages.create({
                                from: 'whatsapp:+14155238886',
                                to: from,
                                body: "🎉 Here's your NDA document (PDF).",
                                mediaUrl: [`https://d1cc-103-159-214-186.ngrok-free.app/nda/${fileName}`] // You must serve this file publicly
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
