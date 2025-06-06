document.addEventListener('DOMContentLoaded', function () {
  // Constants for gas laws
  const IDEAL_GAS_CONSTANT = 8.314; // J/(mol·K)
  const PARTICLE_MOLES = 0.01; // Moles per particle addition
  const STANDARD_PRESSURE = 101.325; // Standard atmospheric pressure in kPa

  // Simulation elements
  const canvas = document.getElementById('particleCanvas');
  const ctx = canvas.getContext('2d');

  // Simulation parameters
  let particles = [];
  let temperature = 300; // Kelvin (start at 300K ~ 27°C)
  let pressure = STANDARD_PRESSURE; // in kPa
  let isExploded = false;
  let explosionParticles = [];
  let containerVolume = 0.01; // Initial volume in m³ (10L)
  let maxPressure = 1000; // kPa (adjustable via slider)
  let maxVolumeBeforeExplosion = 0;
  let pressureAtExplosion = 0;
  let particlesAtExplosion = 0;
  let particleCount = 5; // Default number of particles to add
  let boxWidth = 300;
  let boxHeight = 300;
  let boxX = 0;
  let boxY = 0;
  let isExploding = false;
  let explosionProgress = 0;
  const explosionDuration = 60; // frames
  const MAX_BOX_SIZE = 2000;

  // Center the box in the canvas
  function centerBox() {
    boxX = (canvas.width - boxWidth) / 2;
    boxY = (canvas.height - boxHeight) / 2;
  }

  // Update box dimensions while maintaining center
  function updateBoxDimensions() {
    // Get new dimensions from inputs
    boxWidth = Math.min(parseInt(document.getElementById('boxWidthInput').value), MAX_BOX_SIZE);
    boxHeight = Math.min(parseInt(document.getElementById('boxHeightInput').value), MAX_BOX_SIZE);

    // Update UI elements
    document.getElementById('boxWidth').value = boxWidth;
    document.getElementById('boxHeight').value = boxHeight;
    document.getElementById('boxWidthInput').value = boxWidth;
    document.getElementById('boxHeightInput').value = boxHeight;
    document.getElementById('boxWidthValue').textContent = boxWidth;
    document.getElementById('boxHeightValue').textContent = boxHeight;

    // Re-center the box
    centerBox();

    calculateVolume();
    updatePressure();
  }

  // Handle window resize
  function handleResize() {
    const simulationContainer = document.querySelector('.simulation-container');
    canvas.width = simulationContainer.clientWidth;
    canvas.height = window.innerHeight * 0.7;

    const gasContainer = document.querySelector('.canvas-container');
    gasContainer.style.width = `${canvas.width}px`;
    gasContainer.style.height = `${canvas.height}px`;

    // Center the box after resize
    centerBox();

    calculateVolume();
    updatePressure();
  }

  // Calculate container volume based on dimensions
  function calculateVolume() {
    const widthMeters = boxWidth / 1000;
    const heightMeters = boxHeight / 1000;
    containerVolume = widthMeters * heightMeters * 0.1; // Depth factor
    return containerVolume;
  }

  // Calculate pressure using Ideal Gas Law: P = nRT/V
  function calculatePressure() {
    const moles = particles.length * PARTICLE_MOLES;
    if (containerVolume <= 0) return Infinity;
    const pressurePascals = (moles * IDEAL_GAS_CONSTANT * temperature) / containerVolume;
    return pressurePascals / 1000; // Convert Pa to kPa
  }

  // Update pressure display and check for explosion
  function updatePressure() {
    pressure = calculatePressure();
    const pressureValueElement = document.getElementById('pressureValue');
    pressureValueElement.textContent = pressure.toFixed(1);

    if (pressure > maxPressure) {
      pressureValueElement.style.color = '#e74c3c';
      if (!isExploded) explode();
    } else if (pressure > maxPressure * 0.8) {
      pressureValueElement.style.color = '#f39c12';
    } else if (pressure > maxPressure * 0.6) {
      pressureValueElement.style.color = '#f1c40f';
    } else if (pressure > STANDARD_PRESSURE) {
      pressureValueElement.style.color = '#2ecc71';
    } else {
      pressureValueElement.style.color = '#3498db';
    }

    updateGasLawExplanation();
  }

  // Particle class
  class Particle {
    constructor(centerX, centerY, isExplosion = false) {
      this.radius = 3 + Math.random() * 3;
      this.isExplosionParticle = isExplosion;
      this.mass = this.radius * 0.5;

      if (isExplosion) {
        this.x = centerX;
        this.y = centerY;
      } else {
        const spawnRadius = Math.min(boxWidth, boxHeight) * 0.4;
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * spawnRadius;
        this.x = Math.max(
          boxX + this.radius,
          Math.min(centerX + Math.cos(angle) * distance, boxX + boxWidth - this.radius)
        );
        this.y = Math.max(
          boxY + this.radius,
          Math.min(centerY + Math.sin(angle) * distance, boxY + boxHeight - this.radius)
        );
      }

      this.vx = ((Math.random() - 0.5) * temperature) / 100;
      this.vy = ((Math.random() - 0.5) * temperature) / 100;
      this.color = isExplosion
        ? `hsl(${Math.random() * 60}, 100%, 50%)`
        : `hsl(${200 + Math.random() * 60}, 70%, 60%)`;
    }

    checkCollision(other) {
      const dx = this.x - other.x;
      const dy = this.y - other.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      return distance < this.radius + other.radius;
    }

    handleCollision(other) {
      const dx = other.x - this.x;
      const dy = other.y - this.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance === 0) return;
      const nx = dx / distance;
      const ny = dy / distance;

      const vx = this.vx - other.vx;
      const vy = this.vy - other.vy;
      const velAlongNormal = vx * nx + vy * ny;

      if (velAlongNormal > 0) return;

      const restitution = 0.8;
      const j = -(1 + restitution) * velAlongNormal;
      const totalMass = this.mass + other.mass;
      const impulse = j / totalMass;

      this.vx -= impulse * nx * other.mass;
      this.vy -= impulse * ny * other.mass;
      other.vx += impulse * nx * this.mass;
      other.vy += impulse * ny * this.mass;

      const overlap = (this.radius + other.radius - distance) * 0.5;
      if (overlap > 0) {
        this.x -= overlap * nx;
        this.y -= overlap * ny;
        other.x += overlap * nx;
        other.y += overlap * ny;
      }
    }

    update() {
      this.x += this.vx;
      this.y += this.vy;

      if (this.isExplosionParticle) {
        this.vy += 0.05;
        if (this.alpha !== undefined) {
          this.alpha -= this.decay;
        }
      } else if (!isExploded) {
        this.vx *= 0.999;
        this.vy *= 0.999;
      }

      if (!isExploded || this.isExplosionParticle) {
        if (this.x < boxX + this.radius || this.x > boxX + boxWidth - this.radius) {
          this.vx = -this.vx * 0.9;
          this.x = Math.max(boxX + this.radius, Math.min(this.x, boxX + boxWidth - this.radius));
        }
        if (this.y < boxY + this.radius || this.y > boxY + boxHeight - this.radius) {
          this.vy = -this.vy * 0.9;
          this.y = Math.max(boxY + this.radius, Math.min(this.y, boxY + boxHeight - this.radius));
        }
      }

      const maxVel = temperature / 50;
      const vel = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
      if (vel > maxVel) {
        this.vx = (this.vx / vel) * maxVel;
        this.vy = (this.vy / vel) * maxVel;
      }
    }

    draw() {
      ctx.save();
      if (this.alpha !== undefined) {
        ctx.globalAlpha = Math.max(0, this.alpha);
      }
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fillStyle = this.color;
      ctx.fill();
      ctx.restore();
    }

    isFinished() {
      return this.alpha !== undefined && this.alpha <= 0;
    }
  }

  function drawBox() {
    if (isExploding) {
      // Draw explosion particles
      ctx.save();
      for (const fragment of explosionParticles) {
        if (fragment.width) { // This is a box fragment
          ctx.save();
          ctx.translate(fragment.x, fragment.y);
          ctx.rotate(fragment.rotation);
          ctx.globalAlpha = fragment.alpha;
          ctx.fillStyle = fragment.color;
          ctx.fillRect(-fragment.width / 2, -fragment.height / 2, fragment.width, fragment.height);
          ctx.restore();
        }
      }
      ctx.restore();

      // Draw shockwave
      if (explosionProgress < explosionDuration / 2) {
        const radius = explosionProgress * 10;
        ctx.save();
        ctx.beginPath();
        ctx.arc(boxX + boxWidth / 2, boxY + boxHeight / 2, radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 165, 0, ${1 - explosionProgress / explosionDuration})`;
        ctx.lineWidth = 5;
        ctx.stroke();
        ctx.restore();
      }

      explosionProgress++;
      if (explosionProgress >= explosionDuration) {
        isExploding = false;
      }
    } else if (!isExploded) {
      // Draw normal box
      ctx.strokeStyle = '#4361ee';
      ctx.lineWidth = 3;
      ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);
      ctx.fillStyle = 'rgba(67, 97, 238, 0.05)';
      ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
    }
  }

  function addGas() {
    if (isExploded) return;

    const centerX = boxX + boxWidth / 2;
    const centerY = boxY + boxHeight / 2;

    for (let i = 0; i < particleCount; i++) {
      particles.push(new Particle(centerX, centerY));
    }
    updatePressure();
  }

  function handleCollisions() {
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        if (particles[i].checkCollision(particles[j])) {
          particles[i].handleCollision(particles[j]);
        }
      }
    }
  }

  function explode() {
    if (isExploded) return;
    isExploded = true;
    isExploding = true;
    explosionProgress = 0;

    // Store explosion stats
    maxVolumeBeforeExplosion = containerVolume;
    pressureAtExplosion = pressure;
    particlesAtExplosion = particles.length;

    // Update UI
    document.getElementById('maxVolumeValue').textContent = maxVolumeBeforeExplosion.toFixed(4);
    document.getElementById('explosionPressureValue').textContent = pressureAtExplosion.toFixed(1);
    document.getElementById('explosionParticlesValue').textContent = particlesAtExplosion;
    document.getElementById('explosionStats').style.display = 'block';

    const centerX = boxX + boxWidth / 2;
    const centerY = boxY + boxHeight / 2;
    const explosionPower = Math.min(50, Math.max(10, pressure / 30));

    // Create box fragments
    const fragmentCount = 20;
    for (let i = 0; i < fragmentCount; i++) {
      const size = 10 + Math.random() * 20;
      const fragment = {
        x: boxX + Math.random() * boxWidth,
        y: boxY + Math.random() * boxHeight,
        width: size,
        height: size,
        vx: (Math.random() - 0.5) * explosionPower * 2,
        vy: (Math.random() - 0.5) * explosionPower * 2 - 2,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.2,
        alpha: 1,
        decay: 0.005 + Math.random() * 0.01,
        color: `hsl(${Math.random() * 30 + 10}, 100%, 50%)`
      };
      explosionParticles.push(fragment);
    }

    // Convert existing particles to explosion particles
    particles.forEach((p) => {
      const dx = p.x - centerX;
      const dy = p.y - centerY;
      const distance = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      const force = explosionPower * (1 + Math.random() * 0.5);
      p.vx = (dx / distance) * force;
      p.vy = (dy / distance) * force - 2;
      p.color = `hsl(${Math.random() * 60}, 100%, 50%)`;
      p.isExplosionParticle = true;
      p.alpha = 1;
      p.decay = 0.01 + Math.random() * 0.02;
    });

    // Add additional explosion particles
    for (let i = 0; i < 100; i++) {
      const p = new Particle(centerX, centerY, true);
      p.alpha = 1;
      p.decay = 0.005 + Math.random() * 0.015;
      explosionParticles.push(p);
    }

    // Play explosion sound
    playExplosionSound();
  }

  function playExplosionSound() {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Explosion sound parameters
      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(150, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 1);

      gainNode.gain.setValueAtTime(0.8, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 1);

      oscillator.start();
      oscillator.stop(audioContext.currentTime + 1);
    } catch (e) {
      console.log('AudioContext error:', e);
    }
  }

  function updateGasLawExplanation() {
    const explanationElement = document.getElementById('gasLawExplanation');
    const moles = (particles.length * PARTICLE_MOLES).toFixed(3);
    const vol = containerVolume.toFixed(4);
    const pressureRatio = (pressure / maxPressure).toFixed(2);

    let warningMessage = '';
    if (pressure > maxPressure * 0.8 && !isExploded) {
      warningMessage = `
        <div class="pressure-warning">
            <strong style="color: #e74c3c;">${pressure > maxPressure ? 'EXPLODED!' : 'WARNING:'}</strong>
            <span style="color: #e74c3c;">
                Pressure is at ${(pressureRatio * 100).toFixed(0)}% of container strength!
            </span>
            ${pressure > maxPressure
          ? "<div>The container couldn't withstand the pressure and ruptured!</div>"
          : ''
        }
        </div>
      `;
    }

    explanationElement.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
          <div style="font-size: 1.5rem; color: #4361ee;">PV = nRT</div>
          <div style="flex-grow: 1; border-top: 1px dashed #ddd;"></div>
      </div>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 8px;">
          <div>
              <strong>Current Values:</strong>
              <div style="font-size: 0.85rem;">
                  n = ${moles} mol<br>
                  T = ${temperature} K<br>
                  V = ${vol} m³
              </div>
          </div>
          <div>
              <strong>Calculated:</strong>
              <div style="font-size: 1.1rem; font-weight: bold; color: ${document.getElementById('pressureValue').style.color}">
                  P = ${pressure.toFixed(1)} kPa
              </div>
              <div style="font-size: 0.85rem; color: #7f8c8d">
                  (Max: ${maxPressure} kPa)
              </div>
          </div>
      </div>
      
      ${warningMessage}
      
      <div style="margin-top: 8px; font-size: 0.85rem; color: #7f8c8d">
          <strong>Experiment:</strong> Try changing temperature, adding particles, or changing the container strength.
      </div>
    `;
  }

  function reset() {
    particles = [];
    explosionParticles = [];
    temperature = 300;
    document.getElementById('temperature').value = (temperature - 200) / 10;
    document.getElementById('temperatureInput').value = temperature;
    document.getElementById('temperatureValue').textContent = temperature;

    maxPressure = 1000;
    document.getElementById('containerStrength').value = maxPressure;
    document.getElementById('strengthInput').value = maxPressure;
    document.getElementById('strengthValue').textContent = maxPressure;
    document.getElementById('maxPressureValue').textContent = maxPressure;

    pressure = STANDARD_PRESSURE;
    isExploded = false;
    isExploding = false;
    explosionProgress = 0;

    // Reset box dimensions
    boxWidth = 300;
    boxHeight = 300;
    document.getElementById('boxWidth').value = boxWidth;
    document.getElementById('boxHeight').value = boxHeight;
    document.getElementById('boxWidthInput').value = boxWidth;
    document.getElementById('boxHeightInput').value = boxHeight;
    document.getElementById('boxWidthValue').textContent = boxWidth;
    document.getElementById('boxHeightValue').textContent = boxHeight;

    document.getElementById('pressureValue').textContent = STANDARD_PRESSURE.toFixed(1);
    document.getElementById('pressureValue').style.color = '#3498db';
    document.getElementById('explosionStats').style.display = 'none';

    // Center the box
    centerBox();
    updateGasLawExplanation();
  }

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawBox();

    if (!isExploded) {
      handleCollisions();
    }

    // Update and draw particles
    for (let i = particles.length - 1; i >= 0; i--) {
      particles[i].update();
      particles[i].draw();
      if (particles[i].isFinished && particles[i].isFinished()) {
        particles.splice(i, 1);
      }
    }

    // Update and draw explosion particles
    for (let i = explosionParticles.length - 1; i >= 0; i--) {
      const p = explosionParticles[i];

      // Update position and rotation for fragments
      if (p.width) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.1; // Gravity
        p.rotation += p.rotationSpeed;
        p.alpha -= p.decay;
      }
      // Regular particles are handled by their own update method

      // Draw if it's a fragment (particles draw themselves)
      if (p.width) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.width / 2, -p.height / 2, p.width, p.height);
        ctx.restore();
      } else {
        p.draw();
      }

      // Remove if faded out
      if (p.alpha <= 0) {
        explosionParticles.splice(i, 1);
      }
    }

    requestAnimationFrame(animate);
  }


  // Event listeners
  document.getElementById('boxWidth').addEventListener('input', function () {
    boxWidth = Math.min(parseInt(this.value), MAX_BOX_SIZE);
    document.getElementById('boxWidthInput').value = boxWidth;
    document.getElementById('boxWidthValue').textContent = boxWidth;
    centerBox();
    calculateVolume();
    updatePressure();
  });

  document.getElementById('boxHeight').addEventListener('input', function () {
    boxHeight = Math.min(parseInt(this.value), MAX_BOX_SIZE);
    document.getElementById('boxHeightInput').value = boxHeight;
    document.getElementById('boxHeightValue').textContent = boxHeight;
    centerBox();
    calculateVolume();
    updatePressure();
  });

  document.getElementById('boxWidthInput').addEventListener('change', updateBoxDimensions);
  document.getElementById('boxHeightInput').addEventListener('change', updateBoxDimensions);

  document.getElementById('particleCount').addEventListener('input', function () {
    particleCount = parseInt(this.value);
    if (isNaN(particleCount)) particleCount = 1;
    this.value = particleCount;
  });

  document.getElementById('temperatureInput').addEventListener('input', function () {
    const temp = parseInt(this.value);
    if (isNaN(temp)) return;

    temperature = Math.max(1, temp);
    this.value = temperature;
    document.getElementById('temperature').value = (temperature - 200) / 10;
    document.getElementById('temperatureValue').textContent = temperature;

    if (!isExploded) {
      const scaleFactor = Math.sqrt(temperature / 300);
      particles.forEach((p) => {
        p.vx *= scaleFactor;
        p.vy *= scaleFactor;
      });
    }
    updatePressure();
  });

  document.getElementById('temperature').addEventListener('input', function () {
    temperature = 200 + parseInt(this.value) * 10;
    document.getElementById('temperatureValue').textContent = temperature;
    document.getElementById('temperatureInput').value = temperature;

    if (!isExploded) {
      const scaleFactor = Math.sqrt(temperature / 300);
      particles.forEach((p) => {
        p.vx *= scaleFactor;
        p.vy *= scaleFactor;
      });
    }
    updatePressure();
  });

  document.getElementById('strengthInput').addEventListener('input', function () {
    const strength = parseInt(this.value);
    if (isNaN(strength)) return;

    maxPressure = Math.max(1, strength);
    this.value = maxPressure;
    document.getElementById('containerStrength').value = maxPressure;
    document.getElementById('strengthValue').textContent = maxPressure;
    document.getElementById('maxPressureValue').textContent = maxPressure;
    updatePressure();
  });

  document.getElementById('containerStrength').addEventListener('input', function () {
    maxPressure = parseInt(this.value);
    document.getElementById('strengthValue').textContent = maxPressure;
    document.getElementById('maxPressureValue').textContent = maxPressure;
    document.getElementById('strengthInput').value = maxPressure;
    updatePressure();
  });

  document.getElementById('addGasButton').addEventListener('click', addGas);
  document.getElementById('resetButton').addEventListener('click', reset);
  window.addEventListener('resize', handleResize);

  // Initialize
  handleResize();
  centerBox();
  animate();
});