function toggleMenu() {
  const navMenu = document.getElementById("nav-menu");
  navMenu.classList.toggle("active");
}

async function uploadFile(file) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/upload", {
    method: "POST",
    body: formData,
  });

  if (response.ok) {
    const data = await response.json();

    document.getElementById("upload-button").style.display = "none";

    const qrCodeContainer = document.createElement("div");
    qrCodeContainer.id = "qr-code";
    qrCodeContainer.classList.add("center-qr-code");

    document.querySelector(".file-upload-modern").appendChild(qrCodeContainer);

    const shareURL = `${window.location.protocol}//${window.location.host}/file/${data.file_id}`;

    document.getElementById("display-text").textContent = shareURL;

    new QRCode(qrCodeContainer, {
      text: shareURL,
      width: 128,
      height: 128,
    });
  } else {
    alert("File upload failed.");
  }
}

document.getElementById("file-input").addEventListener("change", function (e) {
  const file = e.target.files[0];
  if (file) {
    uploadFile(file);
  }
  const fileName = e.target.files[0]?.name || "Choose a file";
  document.querySelector(".file-text").textContent = fileName;
});
