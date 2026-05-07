// v1.0 | overlay.js

let currentMode = null;
let currentLabel = null;
let activePoints = [];
let mapLedger = {
    polygons: [],
    paths: [],
    points: []
};

const mapContainer = document.getElementById('map-container');
const mapSvg = document.getElementById('map-svg');
const activeLine = document.getElementById('active-line');
const coordX = document.getElementById('coord-x');
const coordY = document.getElementById('coord-y');
const modeDisplay = document.getElementById('current-mode');

// Toolbar logic
document.querySelectorAll('.tool').forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll('.tool').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentMode = btn.dataset.type;
        currentLabel = btn.dataset.label;
        modeDisplay.innerText = `${currentMode} (${currentLabel})`;
        activePoints = [];
        updateActiveLine();
    };
});

// Convert pixel click to 0-100 coordinate
function getNormalizedCoords(e) {
    const rect = mapContainer.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    return [parseFloat(x.toFixed(2)), parseFloat(y.toFixed(2))];
}

mapContainer.onmousemove = (e) => {
    const [x, y] = getNormalizedCoords(e);
    coordX.innerText = Math.round(x);
    coordY.innerText = Math.round(y);

    if (activePoints.length > 0) {
        const pointsStr = activePoints.map(p => p.join(',')).join(' ') + ` ${x},${y}`;
        activeLine.setAttribute("points", pointsStr);
    }
};

mapContainer.onclick = (e) => {
    if (!currentMode) return;

    const coords = getNormalizedCoords(e);
    
    if (currentMode === 'point') {
        const name = prompt("Name this feature:");
        if (name) {
            mapLedger.points.push({ name, x: coords[0], y: coords[1], type: currentLabel });
            renderPermanent();
        }
    } else {
        activePoints.push(coords);
        updateActiveLine();
    }
};

// Finish shape on right click or double click
mapContainer.oncontextmenu = (e) => {
    e.preventDefault();
    finishFeature();
};

function finishFeature() {
    if (activePoints.length < 2) return;

    if (currentMode === 'polygon') {
        const name = prompt(`Name this ${currentLabel} region:`);
        mapLedger.polygons.push({ name: name || "", coords: [...activePoints], type: currentLabel });
    } else if (currentMode === 'path') {
        const name = prompt(`Name this ${currentLabel} route:`);
        mapLedger.paths.push({ name: name || "", coords: [...activePoints], type: currentLabel });
    }

    activePoints = [];
    updateActiveLine();
    renderPermanent();
}

function updateActiveLine() {
    activeLine.setAttribute("points", activePoints.map(p => p.join(',')).join(' '));
}

function renderPermanent() {
    const polyLayer = document.getElementById('polygon-layer');
    const pathLayer = document.getElementById('path-layer');
    const pointLayer = document.getElementById('point-layer');

    polyLayer.innerHTML = '';
    pathLayer.innerHTML = '';
    pointLayer.innerHTML = '';

    mapLedger.polygons.forEach(p => {
        const el = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        el.setAttribute("points", p.coords.map(c => c.join(',')).join(' '));
        el.classList.add('marker-polygon');
        polyLayer.appendChild(el);
    });

    mapLedger.paths.forEach(p => {
        const el = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
        el.setAttribute("points", p.coords.map(c => c.join(',')).join(' '));
        el.classList.add('marker-path');
        pathLayer.appendChild(el);
    });

    mapLedger.points.forEach(p => {
        const el = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        el.setAttribute("cx", p.x); el.setAttribute("cy", p.y); el.setAttribute("r", 0.6);
        el.classList.add('marker-point');
        pointLayer.appendChild(el);
    });
}

// Auto-load image from arena
window.onload = () => {
    const imgData = localStorage.getItem('active_map_image');
    if (imgData) {
        document.getElementById('map-image').src = imgData;
    }
};
