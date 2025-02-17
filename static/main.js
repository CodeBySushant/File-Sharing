function toggleMenu(){
    const navMenu = document.getElementById('nav-menu');
    navMenu.classList.toggle('active');
}

async function uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/upload', {
        method: 'POST',
        body: formData
    });

    if (response.ok) {
        const data = await response.json();
        document.getElementById('upload-button').style.display = 'none';
        const uploadedFileLink = document.createElement('a');
        uploadedFileLink.href = `/file/${data.file_id}`;
        uploadedFileLink.textContent = `Uploaded File: ${file.name}`;
        document.querySelector('.file-upload-modern').appendChild(uploadedFileLink);
    } else {
        alert('File upload failed.');
    }
}

document.getElementById('file-input').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        uploadFile(file);
    }
    const fileName = e.target.files[0]?.name || 'Choose a file';
    document.querySelector('.file-text').textContent = fileName;
});