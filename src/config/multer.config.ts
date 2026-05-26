import multer from 'multer';

const storage = multer.memoryStorage();

const fileFilter = (req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedTypes = /jpeg|jpg|png/;
    const ext = file.originalname.split('.').pop()?.toLowerCase();
    if (ext && allowedTypes.test(ext)) {
        cb(null, true);
    } else {
        cb(new Error('Only JPEG, JPG, PNG allowed'));
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
});

export default upload;
