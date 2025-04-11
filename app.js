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
app.get("/", async (req, res) => {
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
                if (message.toLowerCase() === "1" || message.toLowerCase() === "Create") {
                    twiml.message("Great! Let's begin. Please enter 'Party 1 Name':");
                    console.log("Great! Let's begin. Please enter 'Party 1 Name':");

                    session.step = 2;
                } else if (message.toLowerCase() === "2" || message.toLowerCase() === "view") {
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
                        const publicUrl = `https://0e4f-103-159-214-189.ngrok-free.app/nda/${latestFile}`;

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
                    const writeStream = fs.createWriteStream('./public/' + fileName);
                    doc.pipe(writeStream);

                    // doc.fontSize(20).text("Non-Disclosure Agreement", { align: "center" });
                    // doc.moveDown();
                    // doc.fontSize(12).text(`Date: ${session.data.agreementDate}`);
                    // doc.moveDown();
                    // doc.text(`This Agreement is made between:`);
                    // doc.text(`- Party 1: ${session.data.party1}`);
                    // doc.text(`- Party 2: ${session.data.party2}`);
                    // doc.moveDown();
                    // doc.text(`Confidentiality Terms:\n${session.data.confidentialityTerms}`);
                    // doc.moveDown();
                    // doc.text(`Duration: ${session.data.duration}`);
                    // doc.moveDown();
                    // doc.text(`Governing Law: ${session.data.governingLaw}`);
                    // doc.end();



                    // Header
                    doc.fontSize(20).text("NON-DISCLOSURE AGREEMENT", { align: "center" });
                    doc.moveDown();
                    doc.fontSize(12).text(`Agreement Date: ${session.data.agreementDate}`);
                    doc.moveDown();

                    // Intro
                    doc.text(`THIS NON-DISCLOSURE AGREEMENT is made on this ${session.data.agreementDate} by and between:`);
                    doc.moveDown();
                    doc.text(`Party 1 (Auditee): ${session.data.party1}`);
                    doc.text(`Party 2 (Auditor): ${session.data.party2}`);
                    doc.moveDown();

                    // Recitals
                    doc.text("WHEREAS:");
                    doc.text(`A. ${session.data.party2} is an auditing organization engaged in security assessments, and agrees to follow audit guidelines.`);
                    doc.text(`B. ${session.data.party1} acknowledges the confidentiality and security protocols applicable under the NDA.`);
                    doc.text(`C. Both parties agree to uphold confidentiality terms without reservation.`);
                    doc.moveDown();

                    // Confidentiality Terms
                    doc.font("Helvetica-Bold").text("1. Confidentiality Terms:");
                    doc.font("Helvetica").text(session.data.confidentialityTerms, { indent: 20 });
                    doc.moveDown();

                    // Duration
                    doc.font("Helvetica-Bold").text("2. Duration:");
                    doc.font("Helvetica").text(`This agreement shall remain valid for a period of ${session.data.duration} from the date of signing, unless terminated earlier in writing.`);
                    doc.moveDown();

                    // Governing Law
                    doc.font("Helvetica-Bold").text("3. Governing Law:");
                    doc.font("Helvetica").text(`This Agreement shall be governed by the laws of ${session.data.governingLaw}, and any disputes shall be subject to the exclusive jurisdiction of the courts located therein.`);
                    doc.moveDown();

                    // Sample Clauses
                    doc.font("Helvetica-Bold").text("4. Protection of Confidential Information:");
                    doc.font("Helvetica").text("The Auditor agrees not to disclose, copy, or distribute any Confidential Information without the express written consent of the Auditee.");
                    doc.moveDown();

                    doc.font("Helvetica-Bold").text("5. Return or Destruction of Data:");
                    doc.font("Helvetica").text("Upon termination, the Auditor shall return or destroy all confidential materials in possession.");
                    doc.moveDown();

                    doc.font("Helvetica-Bold").text("6. Entire Agreement:");
                    doc.font("Helvetica").text("This document constitutes the entire agreement and supersedes any prior understanding between the parties.");
                    doc.moveDown();

                    // === New Definitions Section ===
                    doc.addPage(); // Optional: move to new page if needed
                    doc.font("Helvetica-Bold").fontSize(14).text("Definitions", { underline: true });
                    doc.moveDown();

                    doc.font("Helvetica").fontSize(12).text(
                        "a) The term “Confidential Information” shall include, without limitation, all information and materials, " +
                        "furnished by either Party to the other in connection with Auditee products and services including information " +
                        "transmitted in writing, orally, visually (e.g. video terminal display) or on magnetic media, and including all " +
                        "proprietary information, customer & prospect lists, trade secrets, trade names or proposed trade names, methods and " +
                        "procedures of operation, business or marketing plans, licensed document know-how, ideas, concepts, designs, drawings, " +
                        "flow charts, diagrams, quality manuals, checklists, guidelines, processes, formulae, source code materials, specifications, " +
                        "programs, software packages, codes and other intellectual property relating to Auditee products and services. Results of " +
                        "any information security audits, tests, analysis, extracts or usages carried out by the Auditor in connection with the Auditee’s " +
                        "products and/or services, IT infrastructure, etc. shall also be considered Confidential Information.",
                        { indent: 20, lineGap: 4 }
                    );
                    doc.moveDown();

                    doc.text(
                        "b) The term “Auditee products” shall include all such products, goods, services, deliverables, which are subject to audit " +
                        "by the empanelled auditor under the Agreement.",
                        { indent: 20, lineGap: 4 }
                    );
                    doc.moveDown();

                    // Protection of Confidential Information Section
                    doc.font("Helvetica-Bold").fontSize(14).text("Protection of Confidential Information", { underline: true });
                    doc.moveDown();
                    const protectionPoints = [
                        "a) Use the Confidential Information as necessary only in connection with scope of audit and in accordance with the terms and conditions contained herein;",
                        "b) Maintain the Confidential Information in strict confidence and take all reasonable steps to enforce the confidentiality obligations imposed hereunder, but in no event take less care with the Confidential Information than the parties take to protect the confidentiality of its own proprietary and confidential information and that of its other clients;",
                        "c) Not to make or retain copy of any details of products and/or services, prototypes, business or marketing plans, Client lists, Proposals developed by or originating from Auditee or any of the prospective clients of Auditee.",
                        "d) Not to make or retain copy of any details of results of any information security audits, tests, analysis, extracts or usages carried out by the Auditor in connection with the Auditee’s products and/or services, IT infrastructure, etc. without the express written consent of Auditee.",
                        "e) Not to disclose or in any way assist or permit the disclosure of any Confidential Information to any other person or entity without the express written consent of the auditee;",
                        "f) Return to the auditee, or destroy, at auditee’s discretion, any and all Confidential Information disclosed in a printed form or other permanent record, or in any other tangible form (including without limitation, all copies, notes, extracts, analyses, studies, summaries, records and reproductions thereof) immediately on (i) expiration or termination of this agreement, or (ii) the request of Auditee therefor.",
                        "g) Not to send Auditee’s audit information or data and/or any such Confidential Information at any time outside India for the purpose of storage, processing, analysis or handling without the express written consent of the Auditee.",
                        "h) The auditor shall use only the best possible secure methodology to avoid confidentiality breach, while handling audit related data for the purpose of storage, processing, transit or analysis including sharing of information with auditee.",
                        "i) Not to engage or appoint any non-resident/foreigner to undertake any activity related to Information Security Audit.",
                        "j) Not to discuss with any member of public, media, press, or any other person about the nature of arrangement entered into between the Auditor and the Auditee or the nature of services to be provided by Auditor to the Auditee.",
                        "k) Make sure that all the employees and/or consultants engaged to undertake any audit on its behalf have signed the mandatory non-disclosure agreement."
                    ];
                    protectionPoints.forEach(point => {
                        doc.font("Helvetica").fontSize(12).text(point, { indent: 20, lineGap: 4 });
                    });
                    doc.moveDown().moveDown();

                    // === Signature Section ===
                    doc.moveDown().moveDown();
                    doc.fontSize(12).text("IN WITNESS WHEREOF, the parties have executed this Agreement as of the date written above.", {
                        align: 'justify'
                    });

                    doc.moveDown().moveDown();
                    doc.text(`For ${session.data.party1} (Auditee):`, { continued: true }).text(" __________________________", { align: 'right' });
                    doc.text(`Authorized Signatory`, { continued: true }).text(" __________________________", { align: 'right' });
                    doc.moveDown();
                    doc.text(`For ${session.data.party2} (Auditor):`, { continued: true }).text(" __________________________", { align: 'right' });
                    doc.text(`Authorized Signatory`, { continued: true }).text(" __________________________", { align: 'right' });

                    doc.moveDown().moveDown(); -
                        doc.text("WITNESSES:");
                    doc.text("1. __________________________");
                    doc.text("2. __________________________");

                    doc.end();
                    writeStream.on("finish", async () => {
                        try {
                            // Upload PDF to Twilio and send via WhatsApp
                            //console.log(`https://912f-103-159-214-186.ngrok-free.app/nda/${fileName}`);

                            const media = await client.messages.create({
                                from: 'whatsapp:+14155238886',
                                to: from,
                                body: "🎉 Here's your NDA document (PDF).",
                                mediaUrl: [`https://0e4f-103-159-214-189.ngrok-free.app/nda/${fileName}`] // You must serve this file publicly
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
