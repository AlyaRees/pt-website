import nodemailer from "nodemailer"

// Create a transporter using SMTP
const transporter = nodemailer.createTransport({
    service: "gmail",
  auth: {
    user: '',
    pass: '',
  }
});

const mailOptions = {
    from: '',
    to: '',
    subject: 'From Node.js',
    text: 'That was so easy!'
}

transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
        console.log(error)
    } else {
        console.log('Email sent: ' + info.response)
    }
})