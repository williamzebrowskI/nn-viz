document.addEventListener('DOMContentLoaded', function () {
    const container = document.getElementById('gradientMapContainer');

    if (!container) {
        console.error("Container for gradient map not found.");
        return;
    }

    // Create a Three.js scene
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, container.offsetWidth / container.offsetHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.offsetWidth, container.offsetHeight);
    container.appendChild(renderer.domElement);

    let surfaceMesh;
    let gradientPath = [];
    let pathLine;
    let currentDot;
    const surfaceSize = 20;
    const resolution = 50; // Increased resolution for smoother surface
    const maxDepth = 5; // Maximum depth of the surface

    // Adjust camera and controls
    camera.position.set(0, 15, 25);
    camera.lookAt(0, 0, 0);

    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;
    controls.screenSpacePanning = false;
    controls.maxPolarAngle = Math.PI / 2;

    // Define the cost function C(x1, x2) = x1^2 + x2^2
    function cost(x1, x2) {
        return x1 ** 2 + x2 ** 2;
    }

    // Create a curved surface
    function createSurface() {
        console.log("Creating surface...");
        const geometry = new THREE.PlaneGeometry(surfaceSize, surfaceSize, resolution, resolution);
        const positions = geometry.attributes.position.array;

        for (let i = 0; i < positions.length; i += 3) {
            const x = positions[i] / 10;
            const z = positions[i + 2] / 10;
            positions[i + 1] = cost(x, z) * maxDepth / 20;
        }

        geometry.computeVertexNormals();

        const material = new THREE.MeshPhongMaterial({ 
            color: 0x88ccee, 
            side: THREE.DoubleSide,
            wireframe: false
        });
        surfaceMesh = new THREE.Mesh(geometry, material);
        surfaceMesh.rotation.x = -Math.PI / 2;  // Rotate to lay flat
        scene.add(surfaceMesh);
        console.log("Surface created and added to scene.");
    }

    // Add debug helpers
    function addDebugHelpers() {
        const axesHelper = new THREE.AxesHelper(10);
        scene.add(axesHelper);

        const gridHelper = new THREE.GridHelper(20, 20);
        scene.add(gridHelper);

        console.log("Debug helpers added to scene.");
    }

    // Update surface to create a dip
    function updateSurface(position) {
        const positions = surfaceMesh.geometry.attributes.position.array;
        for (let i = 0; i < positions.length; i += 3) {
            const x = positions[i] / 10;
            const z = positions[i + 2] / 10;
            let y = cost(x, z) * maxDepth / 20;

            // Create a dip around the current position
            const dx = x - position.x;
            const dz = z - position.z;
            const distance = Math.sqrt(dx * dx + dz * dz);
            const dip = Math.exp(-distance * 2) * maxDepth / 4;
            y -= dip;

            positions[i + 1] = y;
        }
        surfaceMesh.geometry.attributes.position.needsUpdate = true;
        surfaceMesh.geometry.computeVertexNormals();
    }

    // Update visualization based on gradient
    function updateVisualization(outputGradients) {
        console.log("Updating visualization with:", outputGradients);

        const [x, y] = outputGradients[outputGradients.length - 1];
        const height = cost(x, y) * maxDepth / 20;

        // Exaggerate the movement for visibility
        const scaleFactor = 5;
        const newPoint = new THREE.Vector3(x * scaleFactor, height, y * scaleFactor);
        gradientPath.push(newPoint);

        // Update surface
        updateSurface(newPoint);

        // Update or create the path line
        if (pathLine) scene.remove(pathLine);
        const lineMaterial = new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 2 });
        const lineGeometry = new THREE.BufferGeometry().setFromPoints(gradientPath);
        pathLine = new THREE.Line(lineGeometry, lineMaterial);
        scene.add(pathLine);

        // Update or create the current position dot
        if (currentDot) scene.remove(currentDot);
        const dotGeometry = new THREE.SphereGeometry(0.2, 32, 32);
        const dotMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        currentDot = new THREE.Mesh(dotGeometry, dotMaterial);
        currentDot.position.copy(newPoint);
        scene.add(currentDot);

        console.log("Visualization updated. Path length:", gradientPath.length);
    }

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(10, 10, 10).normalize();
    scene.add(directionalLight);

    // Create the surface and add debug helpers
    createSurface();
    addDebugHelpers();

    // Render loop
    function animate() {
        requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
    }
    animate();

    console.log("Animation loop started.");

    // Handle window resize
    window.addEventListener('resize', () => {
        camera.aspect = container.offsetWidth / container.offsetHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.offsetWidth, container.offsetHeight);
    });

    // Expose update function to global scope
    window.updateVisualization = updateVisualization;

    // Assume socket is defined elsewhere
    if (typeof socket !== 'undefined') {
        socket.on('gradient_update', function(data) {
            console.log("Received gradient update from socket:", data);
            try {
                const outputGradients = data.backward_data.output_grad;
                if (!outputGradients) {
                    throw new Error("Invalid gradient data structure");
                }
                window.updateVisualization(outputGradients);
            } catch (error) {
                console.error("Error processing gradient update:", error);
            }
        });
    } else {
        console.warn("Socket is not defined. Gradient updates will not be received.");
    }

    // Log scene contents
    console.log("Scene children:", scene.children);
});