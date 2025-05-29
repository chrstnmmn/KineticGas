document.addEventListener("DOMContentLoaded", function () {
	// Canvas setup
	const canvas = document.getElementById("particleCanvas");
	const ctx = canvas.getContext("2d");

	// Set canvas dimensions
	function resizeCanvas() {
		const containerWidth = canvas.parentElement.clientWidth;
		canvas.width = containerWidth;
		canvas.height = 400; // Fixed height
	}

	// Control elements
	const numParticlesSlider = document.getElementById("numParticles");
	const numParticlesValue = document.getElementById("numParticlesValue");
	const temperatureSlider = document.getElementById("temperature");
	const temperatureValue = document.getElementById("temperatureValue");
	const particleSizeSlider = document.getElementById("particleSize");
	const particleSizeValue = document.getElementById("particleSizeValue");
	const resetButton = document.getElementById("resetButton");
	const addGasButton = document.getElementById("addGasButton");
	const pauseButton = document.getElementById("pauseButton");

	// Simulation state
	let particles = [];
	let numParticles = parseInt(numParticlesSlider.value);
	let temperature = parseInt(temperatureSlider.value);
	let particleRadius = parseInt(particleSizeSlider.value);
	let isPaused = false;
	let animationId = null;

	// Particle class
	class Particle {
		constructor() {
			this.radius = particleRadius;
			this.x =
				this.radius + Math.random() * (canvas.width - this.radius * 2);
			this.y =
				this.radius + Math.random() * (canvas.height - this.radius * 2);
			this.vx = (Math.random() - 0.5) * temperature;
			this.vy = (Math.random() - 0.5) * temperature;
			this.color = `hsl(${Math.random() * 360}, 70%, 60%)`;
		}

		draw() {
			ctx.beginPath();
			ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
			ctx.fillStyle = this.color;
			ctx.fill();
		}

		update() {
			if (isPaused) return;

			// Update position
			this.x += this.vx;
			this.y += this.vy;

			// Wall collisions
			if (this.x < this.radius || this.x > canvas.width - this.radius) {
				this.vx = -this.vx;
			}
			if (this.y < this.radius || this.y > canvas.height - this.radius) {
				this.vy = -this.vy;
			}
		}
	}

	// Initialize particles
	function initParticles() {
		particles = [];
		for (let i = 0; i < numParticles; i++) {
			particles.push(new Particle());
		}
	}

	// Add more particles
	function addParticles(count) {
		for (let i = 0; i < count; i++) {
			particles.push(new Particle());
		}
		numParticles = particles.length;
		numParticlesSlider.value = numParticles;
		numParticlesValue.textContent = numParticles;
	}

	// Handle particle collisions
	function handleCollisions() {
		for (let i = 0; i < particles.length; i++) {
			for (let j = i + 1; j < particles.length; j++) {
				const p1 = particles[i];
				const p2 = particles[j];

				const dx = p2.x - p1.x;
				const dy = p2.y - p1.y;
				const distance = Math.sqrt(dx * dx + dy * dy);

				if (distance < p1.radius + p2.radius) {
					// Simple collision response
					const angle = Math.atan2(dy, dx);
					const speed1 = Math.sqrt(p1.vx * p1.vx + p1.vy * p1.vy);
					const speed2 = Math.sqrt(p2.vx * p2.vx + p2.vy * p2.vy);

					const direction1 = Math.atan2(p1.vy, p1.vx);
					const direction2 = Math.atan2(p2.vy, p2.vx);

					const velocityX1 = speed1 * Math.cos(direction1 - angle);
					const velocityY1 = speed1 * Math.sin(direction1 - angle);
					const velocityX2 = speed2 * Math.cos(direction2 - angle);
					const velocityY2 = speed2 * Math.sin(direction2 - angle);

					// Swap velocities
					p1.vx =
						Math.cos(angle) * velocityX2 +
						Math.cos(angle + Math.PI / 2) * velocityY1;
					p1.vy =
						Math.sin(angle) * velocityX2 +
						Math.sin(angle + Math.PI / 2) * velocityY1;
					p2.vx =
						Math.cos(angle) * velocityX1 +
						Math.cos(angle + Math.PI / 2) * velocityY2;
					p2.vy =
						Math.sin(angle) * velocityX1 +
						Math.sin(angle + Math.PI / 2) * velocityY2;

					// Move particles apart to prevent sticking
					const overlap = (p1.radius + p2.radius - distance) / 2;
					p1.x -= overlap * Math.cos(angle);
					p1.y -= overlap * Math.sin(angle);
					p2.x += overlap * Math.cos(angle);
					p2.y += overlap * Math.sin(angle);
				}
			}
		}
	}

	// Animation loop
	function animate() {
		ctx.clearRect(0, 0, canvas.width, canvas.height);

		// Update and draw particles
		particles.forEach((particle) => {
			particle.update();
			particle.draw();
		});

		handleCollisions();

		animationId = requestAnimationFrame(animate);
	}

	// Event listeners
	numParticlesSlider.addEventListener("input", function () {
		numParticles = parseInt(this.value);
		numParticlesValue.textContent = numParticles;
		initParticles();
	});

	temperatureSlider.addEventListener("input", function () {
		temperature = parseInt(this.value);
		temperatureValue.textContent = temperature;

		// Update all particle speeds
		particles.forEach((p) => {
			p.vx = (Math.random() - 0.5) * temperature;
			p.vy = (Math.random() - 0.5) * temperature;
		});
	});

	particleSizeSlider.addEventListener("input", function () {
		particleRadius = parseInt(this.value);
		particleSizeValue.textContent = particleRadius;

		// Update all particle sizes
		particles.forEach((p) => {
			p.radius = particleRadius;
		});
	});

	resetButton.addEventListener("click", function () {
		numParticles = 100;
		temperature = 5;
		particleRadius = 3;

		numParticlesSlider.value = numParticles;
		temperatureSlider.value = temperature;
		particleSizeSlider.value = particleRadius;

		numParticlesValue.textContent = numParticles;
		temperatureValue.textContent = temperature;
		particleSizeValue.textContent = particleRadius;

		initParticles();
	});

	addGasButton.addEventListener("click", function () {
		addParticles(20);
	});

	pauseButton.addEventListener("click", function () {
		isPaused = !isPaused;
		this.textContent = isPaused ? "Resume" : "Pause";
	});

	// Initialize
	window.addEventListener("resize", function () {
		resizeCanvas();
		// Reposition particles after resize
		particles.forEach((p) => {
			p.x = Math.max(p.radius, Math.min(canvas.width - p.radius, p.x));
			p.y = Math.max(p.radius, Math.min(canvas.height - p.radius, p.y));
		});
	});

	resizeCanvas();
	initParticles();
	animate();
});
