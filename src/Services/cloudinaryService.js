const CLOUD_NAME = "gxgj4poh";
const UPLOAD_PRESET = "trenchtalk_profiles";

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

const MAX_FILE_SIZE = 8 * 1024 * 1024;

export async function uploadProfileImage(file, imageType = "avatar") {
  if (!file) {
    throw new Error("Please select an image.");
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error("Please upload a JPG, PNG, WEBP or GIF image.");
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error("Images must be smaller than 8MB.");
  }

  if (!["avatar", "banner"].includes(imageType)) {
    throw new Error("Invalid image type.");
  }

  const formData = new FormData();

  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);
  formData.append("folder", "trenchtalk/profiles");

  try {
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
      {
        method: "POST",
        body: formData,
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.error?.message || "Image upload failed."
      );
    }

    return {
      url: result.secure_url,
      publicId: result.public_id,
      imageType,
    };
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    throw error;
  }
}