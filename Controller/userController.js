import { User } from "../Models/userCollection.js";
import bcrypt from 'bcrypt'
import logger from "../Utilis/logger.js";
import jwt from 'jsonwebtoken'
import { PDFDocument } from 'pdf-lib';
import dotenv from 'dotenv'
dotenv.config()

const userController={

    signup:async(req,res)=>{
        try {
            const {name,email,password}=req.body
            const hashpassword=await bcrypt.hash(password,10)
            const existingUser=await User.findOne({email:email})
            if(existingUser){
                logger.warn(`Signup failed: User with email ${email} already exists.`);
                return res.status(400).json({success:false,message:"User already registered"})
            }
            const newUser=new User({
                name:name,
                email:email,
                password:hashpassword
            })
            await newUser.save()
            logger.info(`User registered successfully with email: ${email}`)
            return res.status(201).json({success:true,message:"User registered successfully"})
        } catch (error) {
            logger.error(`Error during signup for email ${req.body.email}: ${error.message}`);
            return res.status(500).json({success:false,message:"An error occurred while registering the user. Please try again."})
        }
    },
    login:async(req,res)=>{
        try {            
            const{email,password}=req.body;
            const user=await User.findOne({email:email})
            if(!user){
                return res.json({success:false,message:"User not registered"})
            }
            const validPassword=await bcrypt.compare(password,user.password)
            if(!validPassword){
                return res.json({success:false,message:"Incorrect password"})
            }
            const token=jwt.sign({email:user.email},process.env.KEY,{expiresIn:'1h'})            
            res.cookie('token',token,{httpOnly:true,maxAge:360000})
            return res.json({success:true,message:"Login successfully",user,token})
        } catch (error) {
            logger.error(`Error during signin for email ${req.body.email}: ${error.message}`);
            return res.status(500).json({success:false,message:"An error occurred while login the user. Please try again."})
        }
    },
    isVerify:async(req,res)=>{
        try {
            return res.status(200).json({success:true,message:"User verified",user:req.user})
        } catch (error) {
            logger.error(`Verification error: ${error.message}`);
            res.status(500).json({ message: "Internal server error" });
        }
    },
    uploadPdf:async(req,res)=>{
        try {
            const id=req.user._id
            if(!req.file){
                return res.status(400).json({ success: false, message: "No file uploaded" });
            }
            const updatedUser=await User.findByIdAndUpdate({_id:id},{
                $push:{uploadedFile:req.file.buffer}
            },{new:true})
            logger.info(`PDF uploaded successfully by user: ${req.user.email}`);
            res.status(200).json({ success: true, message: "PDF uploaded successfully", user: updatedUser });
        } catch (error) {
            logger.error(`Error uploading PDF: ${error.message}`);
            res.status(500).json({ success: false, message: "Error uploading PDF" });
        }
    },
    fetchPdf :async (req, res) => {
        try {
            const userId = req.user._id;
            const user = await User.findById(userId);
    
            if (!user || !user.uploadedFile || user.uploadedFile.length === 0) {
                return res.status(404).json({ success: false, message: "No PDF files found for this user." });
            }
    
            const pdfFiles = user.uploadedFile.map((buffer, index) => ({
                fileName: `user_${userId}_file_${index + 1}.pdf`,
                base64: buffer.toString('base64'),  
            }));
    
            res.status(200).json({ success: true, message: "PDF files retrieved successfully", pdfs: pdfFiles });
        } catch (error) {
            logger.error(`Error fetching PDFs for user ${req.user.email}: ${error.message}`);
            res.status(500).json({ success: false, message: "Error fetching PDF files" });
        }
    },
    regeneratePdf: async (req, res) => {
        try {
          const { selectedPages, pdf } = req.body;
          const originalPdfBytes = Uint8Array.from(atob(pdf), c => c.charCodeAt(0));
          const originalPdfDoc = await PDFDocument.load(originalPdfBytes);
          const newPdfDoc = await PDFDocument.create();
    
          for (const pageNumber of selectedPages) {
            const [copiedPage] = await newPdfDoc.copyPages(originalPdfDoc, [pageNumber - 1]);
            newPdfDoc.addPage(copiedPage);
          }
    
          const newPdfBytes = await newPdfDoc.save();
          const newBase64 = btoa(String.fromCharCode(...newPdfBytes));
    
          return res.status(200).json({ success: true, newPdf: newBase64 });
        } catch (error) {
          logger.error(`Error regenerating PDF: ${error.message}`);
          return res.status(500).json({ success: false, message: "Error regenerating PDF" });
        }
      }, 
      deletePdf:async(req,res)=>{
        try {
            const pdfId=req.params.id
            const deletePdf=await User.findByIdAndDelete({})
        } catch (error) {
            
        }

      }, 
    logout:async(req,res)=>{
        try {
            res.clearCookie('token')
            logger.info(`User successfully logged out: ${req.user.email}`);
            res.status(200).json({ success: true, message: "User logout successfully" });
        } catch (error) {
            logger.error(`Logout error: ${error.message}`);
            res.status(500).json({ message: "Internal server error" });
        }
    }
}
export default userController