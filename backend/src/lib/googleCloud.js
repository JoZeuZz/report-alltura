const { Storage } = require('@google-cloud/storage');
const path = require('path');

const storage = new Storage({
  projectId: process.env.GCS_PROJECT_ID,
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
});

const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);

/**
 * Uploads a file to Google Cloud Storage.
 * @param {object} file The file object from multer.
 * @returns {Promise<string>} The public URL of the uploaded file.
 */
const uploadFile = (file) => new Promise((resolve, reject) => {
  const { originalname, buffer } = file;

  // Create a unique filename
  const blob = bucket.file(Date.now() + path.extname(originalname));
  const blobStream = blob.createWriteStream({
    resumable: false,
  });

  blobStream.on('finish', () => {
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;
    resolve(publicUrl);
  })
  .on('error', (err) => {
    reject(`Unable to upload image, something went wrong: ${err}`);
  })
  .end(buffer);
});

module.exports = { uploadFile };
