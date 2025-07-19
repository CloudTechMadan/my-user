const attendanceApi = 'https://jprbceq0dk.execute-api.us-east-1.amazonaws.com/markAttendance';
const presignUrlApi = 'https://jprbceq0dk.execute-api.us-east-1.amazonaws.com/getPresignedUrl';

// Start webcam
navigator.mediaDevices.getUserMedia({ video: true })
  .then(stream => document.getElementById('video').srcObject = stream)
  .catch(err => {
    console.error('Camera error:', err);
    document.getElementById('status').textContent = 'Camera access denied!';
  });

function capture() {
  const video = document.getElementById('video');
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const status = document.getElementById('status');

  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  canvas.toBlob(async (blob) => {
    const fileName = `attendance/${Date.now()}.jpg`;
    status.textContent = 'Uploading...';

    try {
      // Get presigned URL from Lambda
      const presignResp = await fetch(presignUrlApi, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: fileName })
      });

      const { url } = await presignResp.json();

      // Upload image to S3
      const uploadResp = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'image/jpeg' },
        body: blob
      });

      if (!uploadResp.ok) throw new Error('Upload failed');

      // Call markAttendance with S3 key
      const attendanceResp = await fetch(attendanceApi, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ s3Key: fileName })
      });

      const result = await attendanceResp.text();
      status.textContent = result;

    } catch (err) {
      console.error('Error:', err);
      status.textContent = '❌ Something went wrong.';
    }
  }, 'image/jpeg');
}
