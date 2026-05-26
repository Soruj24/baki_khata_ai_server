import { v2 as cloudinary } from "cloudinary";
import type { ConfigOptions } from "cloudinary";
import { Readable } from "stream";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
} as ConfigOptions);

export const uploadToCloudinary = (
  buffer: Buffer,
  folder: string,
): Promise<{ secure_url: string; public_id: string }> => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder },
      (error, result) => {
        if (error) return reject(error);
        resolve({
          secure_url: result!.secure_url,
          public_id: result!.public_id,
        });
      },
    );
    const readable = new Readable();
    readable.push(buffer);
    readable.push(null);
    readable.pipe(uploadStream);
  });
};

export default cloudinary;
