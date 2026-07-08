function toggleTema() {
    const root = document.documentElement;
    root.classList.toggle('light');
    const nuevoTema = root.classList.contains('light') ? 'light' : 'dark';

    localStorage.setItem('ecuasim_tema', nuevoTema);
    actualizarIconoBoton(nuevoTema);
}

function actualizarIconoBoton(tema) {
    const icono = document.getElementById('icono-tema');
    if (!icono) return;

    if (tema === 'light') {
        icono.className = 'bi bi-moon-stars-fill';
    } else {
        icono.className = 'bi bi-sun-fill text-warning';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const temaActual = document.documentElement.classList.contains('light') ? 'light' : 'dark';
    actualizarIconoBoton(temaActual);
});