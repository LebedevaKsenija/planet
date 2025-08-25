import * as THREE from 'three';

// Красивый tooltip
const tooltip = document.createElement('div');
tooltip.style.position = 'fixed';
tooltip.style.padding = '8px 16px';
tooltip.style.background = 'rgba(30,40,60,0.95)';
tooltip.style.color = '#fff';
tooltip.style.borderRadius = '8px';
tooltip.style.pointerEvents = 'none';
tooltip.style.fontSize = '18px';
tooltip.style.fontWeight = 'bold';
tooltip.style.boxShadow = '0 4px 24px 0 rgba(0,0,0,0.25)';
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

scene.add(new THREE.AmbientLight(0xffffff, 0.7));
const pointLight = new THREE.PointLight(0xffffff, 1.2, 100);
pointLight.position.set(5, 5, 5);
scene.add(pointLight);

const loader = new THREE.TextureLoader();
loader.load('planet.jpg', function(texture) {
    // Глобус
    const globe = new THREE.Mesh(
        new THREE.SphereGeometry(1, 64, 64),
        new THREE.MeshPhongMaterial({ map: texture, shininess: 20 })
    );
    globe.rotation.x = 0.35; // наклон вниз
    scene.add(globe);

    // Маркеры и их данные
    const markersData = [
        { lat: 56.95, lon: 24.1, name: 'Latvia' },
        { lat: 54.68, lon: 25.28, name: 'Lithuania' },
        { lat: 59.43, lon: 24.75, name: 'Estonia' },
        { lat: 52.52, lon: 13.4, name: 'Germany' },
        { lat: 40.4, lon: -3.7, name: 'Spain' },
        { lat: 40.38, lon: 49.89, name: 'Azerbaijan' },
        { lat: 41.31, lon: 69.24, name: 'Uzbekistan' },
        { lat: 51.16, lon: 71.43, name: 'Kazakhstan' },
        { lat: 35.18, lon: 33.36, name: 'Cyprus' },
        { lat: 25.27, lon: 55.3, name: 'UAE (Dubai)' },
        { lat: 51.5, lon: -0.12, name: 'UK (London)' },
        { lat: 40.71, lon: -74.0, name: 'USA (New York)' },
        { lat: 34.05, lon: -118.24, name: 'USA (Los Angeles)' }
    ];

    // Для raycaster
    const markerMeshes = [];
    const glowMeshes = [];
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

        // 3D-эффект маркера: отражающий шарик
        const markerMaterial = new THREE.MeshPhongMaterial({
            color: 0xffe066,
            shininess: 100,
            specular: 0xffffff,
            emissive: 0x222200
        });
        const marker = new THREE.Mesh(
            new THREE.SphereGeometry(0.035, 32, 32),
            markerMaterial
        );
        marker.position.copy(pos);
        marker.userData = { name, markerMaterial };
        globe.add(marker);
        markerMeshes.push(marker);

        // Glow-эффект: прозрачная сфера большего радиуса
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: 0xffe066,
            transparent: true,
            opacity: 0.25
        });
        const glow = new THREE.Mesh(
            new THREE.SphereGeometry(0.06, 32, 32),
            glowMaterial
        );
        glow.position.copy(pos);
        globe.add(glow);
        glowMeshes.push(glow);
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
                color: 0x00ffff,
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
        // Красивая дуга между двумя точками на сфере
        const mid = start.clone().add(end).normalize().multiplyScalar(arcHeight);
        return new THREE.QuadraticBezierCurve3(start, mid, end);
    }

    // Вращение
    let scrollPercent = 0;
    window.addEventListener('scroll', () => {
        const docHeight = document.body.scrollHeight - window.innerHeight;
        scrollPercent = docHeight > 0 ? window.scrollY / docHeight : 0;
    });

    // Raycaster для наведения
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let lastPointerEvent = null;
    let isHoveringMarker = false;

    function onPointerMove(event) {
        lastPointerEvent = event;
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    }

    renderer.domElement.addEventListener('pointermove', onPointerMove);

    function animate(time) {
        requestAnimationFrame(animate);

        // Пульсация glow-эффекта
        for (let i = 0; i < glowMeshes.length; i++) {
            const glow = glowMeshes[i];
            const scale = 1 + 0.25 * Math.abs(Math.sin(time * 0.002 + i));
            glow.scale.set(scale, scale, scale);
            glow.material.opacity = 0.15 + 0.25 * Math.abs(Math.sin(time * 0.002 + i));
        }

        // Мерцание дуг
        for (let arc of arcLines) {
            arc.material.opacity = 0.25 + 0.25 * Math.abs(Math.sin(time * 0.001 + arc.id));
        }

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

        // Вращение только если не наведено на маркер
        if (!isHoveringMarker) {
            if (document.body.scrollHeight - window.innerHeight > 0) {
                globe.rotation.y = scrollPercent * 2 * Math.PI;
            } else {
                globe.rotation.y += 0.01;
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