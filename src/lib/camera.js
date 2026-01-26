import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { v4 as uuidv4 } from "uuid";

/**
 * Take a photo with the device camera
 * @returns {Promise<string>} Base64 encoded image
 */
export const takePhoto = async () => {
  try {
    const image = await Camera.getPhoto({
      quality: 90,
      allowEditing: true,
      resultType: CameraResultType.Base64,
      source: CameraSource.Camera,
    });
    return image.base64String;
  } catch (error) {
    console.error("Error taking photo:", error);
    throw error;
  }
};

/**
 * Pick a photo from device gallery
 * @returns {Promise<string>} Base64 encoded image
 */
export const pickPhoto = async () => {
  try {
    const image = await Camera.getPhoto({
      quality: 90,
      allowEditing: true,
      resultType: CameraResultType.Base64,
      source: CameraSource.Photos,
    });
    return image.base64String;
  } catch (error) {
    console.error("Error picking photo:", error);
    throw error;
  }
};

/**
 * Save image file to device storage
 * @param {string} base64Image - Base64 encoded image
 * @param {string} filename - Filename to save as
 * @returns {Promise<string>} Saved file path
 */
export const saveImageToDevice = async (base64Image, filename = null) => {
  try {
    const fileName = filename || `product-${uuidv4()}.jpg`;
    
    await Filesystem.writeFile({
      path: `ProductImages/${fileName}`,
      data: base64Image,
      directory: Directory.Cache,
      recursive: true,
    });

    return `ProductImages/${fileName}`;
  } catch (error) {
    console.error("Error saving image:", error);
    throw error;
  }
};

/**
 * Retrieve image from device storage
 * @param {string} filepath - Image filepath
 * @returns {Promise<string>} Base64 encoded image
 */
export const getImageFromDevice = async (filepath) => {
  try {
    const readFile = await Filesystem.readFile({
      path: filepath,
      directory: Directory.Cache,
    });
    return readFile.data;
  } catch (error) {
    console.error("Error retrieving image:", error);
    throw error;
  }
};

/**
 * Delete image from device storage
 * @param {string} filepath - Image filepath
 * @returns {Promise<void>}
 */
export const deleteImageFromDevice = async (filepath) => {
  try {
    await Filesystem.deleteFile({
      path: filepath,
      directory: Directory.Cache,
    });
  } catch (error) {
    console.error("Error deleting image:", error);
    throw error;
  }
};

/**
 * Compress image (reduce base64 size for faster upload)
 * @param {string} base64Image - Base64 encoded image
 * @param {number} quality - Quality 0-1 (default 0.8)
 * @returns {Promise<string>} Compressed base64 image
 */
export const compressImage = async (base64Image, quality = 0.8) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/jpeg", quality).split(",")[1]);
    };
    img.src = `data:image/jpeg;base64,${base64Image}`;
  });
};
