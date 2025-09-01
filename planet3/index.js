import * as THREE from 'three';

// Tooltip-стилизация
const tooltip = document.createElement('div');
tooltip.style.position = 'fixed';
tooltip.style.background = '#fff';
tooltip.style.color = '#160F29';
tooltip.style.borderRadius = '9999px';
tooltip.style.fontFamily = 'Helvetica, Arial, sans-serif';
tooltip.style.border = '1px solid #000';
tooltip.style.padding = '5px 30px';
tooltip.style.fontSize = '14px';
tooltip.style.fontWeight = 'bold';
tooltip.style.boxShadow = '0 4px 24px 0 rgba(0,0,0,0.10)';
tooltip.style.transition = 'opacity 0.2s';
tooltip.style.opacity = '0';
tooltip.style.zIndex = '1000';
document.body.appendChild(tooltip);



const container = document.getElementById('globe-container');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, container.offsetWidth / container.offsetHeight, 0.1, 1000);
camera.position.z = 3;

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });

renderer.setSize(container.offsetWidth, container.offsetHeight);
container.appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0xffffff, 1.2));

// --- НАСТРОЙКИ ДЛЯ МОБИЛЬНЫХ ---
const isMobile = window.innerWidth < 700;
const markerRadius = 0.02; // одинаковый размер для всех устройств
const hitRadius = isMobile ? 0.06 : markerRadius; // только на мобильных область клика шире

const loader = new THREE.TextureLoader();
loader.load('map3.png', function(texture) {
    // Глобус
// Глобус
const globe = new THREE.Mesh(
    new THREE.SphereGeometry(1, 64, 64),
    new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: 0.6,     // регулируй прозрачность
        depthWrite: true  // ВАЖНО: глобус пишет глубину
    })
);
globe.rotation.x = 0.42;
globe.rotation.z = 0.12;
globe.renderOrder = 0;
scene.add(globe);

const innerSphere = new THREE.Mesh( 
    new THREE.SphereGeometry(0.99, 64, 64), 
    new THREE.MeshBasicMaterial({ color: 0xFFFDF9})
    );
 scene.add(innerSphere);
    // Маркеры и их данные
    const markersData = [
        { lat: 27.68, lon: 11.28, name: 'Latvia' },
        { lat: 24.68, lon: 10.28, name: 'Lithuania' },
        { lat: 30.68, lon: 13.28, name: 'Estonia' },
        { lat: 21.52, lon: 5.4, name: 'Germany' },
        { lat: 12.4, lon: -13.7, name: 'Spain' },
        { lat: 12.38, lon: 37, name: 'Azerbaijan' },
        { lat: 14.31, lon: 49.24, name: 'Uzbekistan' },
        { lat: 18.16, lon: 55.43, name: 'Kazakhstan' },
        { lat: 6.18, lon: 18.36, name: 'Cyprus' },
        { lat: -2.27, lon: 38.3, name: 'UAE' },
        { lat: 22.5, lon: -10, name: 'UK' },
        { lat: 18.71, lon: -77.0, name: 'USA' },
        { lat: 6.05, lon: -124.24, name: 'USA' }
    ];

    // Для raycaster
    const markerMeshes = [];
    const markerPositions = [];

    function latLonToVector3(lat, lon, radius = 1.01) {
        const phi = (90 - lat) * Math.PI / 180;
        const theta = (lon + 180) * Math.PI / 180;
        const x = -radius * Math.sin(phi) * Math.cos(theta);
        const y = radius * Math.cos(phi);
        const z = radius * Math.sin(phi) * Math.sin(theta);
        return new THREE.Vector3(x, y, z);
    }

    function addMarker(lat, lon, name) {
        const pos = latLonToVector3(lat, lon);
        markerPositions.push(pos);

        // Видимый маркер (одинаковый размер)
        const markerMaterial = new THREE.MeshBasicMaterial({ color: 0x160F29 });
        const marker = new THREE.Mesh(
            new THREE.SphereGeometry(markerRadius, 32, 32),
            markerMaterial
        );
        marker.position.copy(pos);
        marker.userData = { name, markerMaterial };
        globe.add(marker);
        markerMeshes.push(marker);

        // Невидимая "зона захвата" для мобильных (шире, но не видна)
        if (isMobile) {
            const hitMaterial = new THREE.MeshBasicMaterial({ visible: false });
            const hitSphere = new THREE.Mesh(
                new THREE.SphereGeometry(hitRadius, 16, 16),
                hitMaterial
            );
            hitSphere.position.copy(pos);
            hitSphere.userData = { name, markerMaterial };
            globe.add(hitSphere);
            markerMeshes.push(hitSphere);
        }
    }

    markersData.forEach(m => addMarker(m.lat, m.lon, m.name));

    // Соединяем все точки дугами
    const arcLines = [];
    for (let i = 0; i < markerPositions.length; i++) {
        for (let j = i + 1; j < markerPositions.length; j++) {
            const start = markerPositions[i];
            const end = markerPositions[j];
            const arcCurve = createArcCurve(start, end, 1.12);
            const arcGeometry = new THREE.BufferGeometry().setFromPoints(arcCurve.getPoints(60));
            const arcMaterial = new THREE.LineBasicMaterial({
                color: 0xC7C7C7,
                linewidth: 2,
                transparent: true,
                opacity: 0.45
            });
            const arc = new THREE.Line(arcGeometry, arcMaterial);
            globe.add(arc);
            arcLines.push(arc);
        }
    }

    function createArcCurve(start, end, arcHeight = 1.12) {
        const mid = start.clone().add(end).normalize().multiplyScalar(arcHeight);
        return new THREE.QuadraticBezierCurve3(start, mid, end);
    }

    // Вращение (только авто)
    let scrollPercent = 0;
    window.addEventListener('scroll', () => {
        const docHeight = document.body.scrollHeight - window.innerHeight;
        scrollPercent = docHeight > 0 ? window.scrollY / docHeight : 0;
    });

    let autoRotationSpeed = 0.004;
    let lastFrameTime = performance.now();

    // Raycaster для наведения
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let lastPointerEvent = null;
    let isHoveringMarker = false;

    // Мышь
    renderer.domElement.addEventListener('pointermove', function(event) {
        if (event.pointerType === 'touch') return; // не мешаем touch
        lastPointerEvent = event;
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    });

    // Touch
    renderer.domElement.addEventListener('touchstart', function(event) {
        if (event.touches.length === 1) {
            const touch = event.touches[0];
            const rect = renderer.domElement.getBoundingClientRect();
            mouse.x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;
            lastPointerEvent = touch;
        }
    });

    function animate(time) {
        requestAnimationFrame(animate);

        // Raycasting
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(markerMeshes, true);

        if (intersects.length > 0 && lastPointerEvent) {
            const marker = intersects[0].object;
            tooltip.textContent = marker.userData.name;
            tooltip.style.display = 'block';
            tooltip.style.opacity = '1';
            tooltip.style.left = `${lastPointerEvent.clientX + 10}px`;
            tooltip.style.top = `${lastPointerEvent.clientY + 10}px`;
            isHoveringMarker = true;
        } else {
            tooltip.style.opacity = '0';
            setTimeout(() => { if (!isHoveringMarker) tooltip.style.display = 'none'; }, 200);
            isHoveringMarker = false;
        }

        // Только авто-вращение
        const now = performance.now();
        const delta = (now - lastFrameTime) / 16.67;
        lastFrameTime = now;

        if (!isHoveringMarker) {
            if (document.body.scrollHeight - window.innerHeight > 0) {
                globe.rotation.y = scrollPercent * 2 * Math.PI;
            } else {
                globe.rotation.y += autoRotationSpeed * delta;
            }
        }

        renderer.render(scene, camera);
    }
    animate(0);

    window.addEventListener('resize', () => {
        camera.aspect = container.offsetWidth / container.offsetHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.offsetWidth, container.offsetHeight);
    });
});