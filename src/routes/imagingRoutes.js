// ============================================
// imagingRoutes.js
// File: backend/src/routes/imagingRoutes.js
// Mount: app.use('/api/v1/imaging', imagingRoutes)
//
// Install deps first:
//   npm install cloudinary multer multer-storage-cloudinary
// ============================================
import express from 'express';
import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import { v2 as cloudinary } from 'cloudinary';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  uploadImage, getAllImages, getImageById, getPatientImages,
  updateImage, deleteImage, analyzeImage, getImagingStats,
} from '../controllers/imagingController.js';

const router = express.Router();
router.use(authenticate);

// ── Cloudinary multer storage ─────────────────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure:     true,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const patientId  = req.body.patient_id || 'unknown';
    const imageType  = (req.body.image_type || 'other').toLowerCase().replace(/\s+/g, '-');
    const isDocument = file.mimetype === 'application/pdf';

    return {
      folder:         `clinicore/medical-images/patient-${patientId}`,
      public_id:      `${imageType}-${Date.now()}`,
      resource_type:  isDocument ? 'raw' : 'image',
      // Auto-format and limit size on non-PDFs
      format:         isDocument ? undefined : 'jpg',
      transformation: isDocument ? undefined : [
        { quality: 'auto:best' },
        { fetch_format: 'auto' },
      ],
    };
  },
});

// ── File filter: images + PDF only, max 20MB ─────────────────────────────────
const fileFilter = (req, file, cb) => {
  const allowed = [
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'image/tiff', 'application/pdf',
  ];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file type: ${file.mimetype}. Upload JPEG, PNG, WEBP, TIFF, or PDF.`), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 },  // 20MB
});

const clinical = authorize('admin', 'doctor', 'nurse', 'radiologist');
const doctors  = authorize('admin', 'doctor', 'radiologist');

// ── Routes ────────────────────────────────────────────────────────────────────
router.get('/stats',                       clinical, getImagingStats);
router.get('/',                            clinical, getAllImages);
router.get('/patient/:patientId',          clinical, getPatientImages);
router.get('/:id',                         authenticate, getImageById);  // patients can view their own

router.post('/upload',
  clinical,
  upload.single('image'),
  (err, req, res, next) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  },
  uploadImage
);

router.put('/:id',                         doctors,  updateImage);
router.post('/:id/analyze',                doctors,  analyzeImage);
router.delete('/:id',                      doctors,  deleteImage);

export default router;