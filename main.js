function toggleMenu(){
    const navMenu = document.getElementById('nav-menu');
    navMenu.classList.toggle('active');
}

document.getElementById('file-input').addEventListener('change', function(e) {
    const fileName = e.target.files[0]?.name || 'Choose a file';
    document.querySelector('.file-text').textContent = fileName;
});