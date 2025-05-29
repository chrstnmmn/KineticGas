document.addEventListener('DOMContentLoaded', function () {
  // Constants for gas laws
  const IDEAL_GAS_CONSTANT = 8.314; // J/(mol·K)
  const PARTICLE_MOLES = 0.01; // Moles per particle addition
  const STANDARD_PRESSURE = 101.325; // Standard atmospheric pressure in kPa

  // Simulation elements
  const canvas = document.getElementById('particleCanvas');
  const ctx = canvas.getContext('2d');
  const container = document.querySelector('#gasContainer');

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

  // Initialize canvas size
  function handleResize() {
    // Get the available space in the middle column
    const middleColumn = document.querySelector('.middle-column');
    const maxAvailableSize = middleColumn.clientWidth;

    // Calculate size (square, fitting available width)
    const size = Math.min(maxAvailableSize, window.innerHeight * 0.7);

    // Set canvas dimensions
    canvas.width = size;
    canvas.height = size;

    // Update container dimensions
    const container = document.querySelector('.canvas-container');
    container.style.width = `${size}px`;
    container.style.height = `${size}px`;

    // Center the box
    boxX = (size - boxWidth) / 2;
    boxY = (size - boxHeight) / 2;

    calculateVolume();
    updatePressure();
  }
  // Set initial canvas size and box position
  function resizeCanvas() {
    // Update slider max values to match canvas size
    const maxDimension = Math.min(canvas.width, canvas.height);
    document.getElementById('boxWidth').max = maxDimension;
    document.getElementById('boxHeight').max = maxDimension;

    // Center the box
    boxX = (canvas.width - boxWidth) / 2;
    boxY = (canvas.height - boxHeight) / 2;

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
    if (containerVolume <= 0) return Infinity; // Avoid division by zero
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

  // Particle class with explosion safety checks
  class Particle {
    constructor(centerX, centerY, isExplosion = false) {
      this.radius = 3 + Math.random() * 3;
      this.isExplosionParticle = isExplosion;
      this.mass = this.radius * 0.5; // Mass proportional to size

      if (isExplosion) {
        this.x = centerX;
        this.y = centerY;
      } else {
        const spawnRadius = Math.min(canvas.width, canvas.height) * 0.1;
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * spawnRadius;
        this.x = Math.max(
          this.radius,
          Math.min(centerX + Math.cos(angle) * distance, canvas.width - this.radius)
        );
        this.y = Math.max(
          this.radius,
          Math.min(centerY + Math.sin(angle) * distance, canvas.height - this.radius)
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
      if (distance === 0) return; // Avoid division by zero
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
        this.vy += 0.05; // Gravity effect
        if (this.alpha !== undefined) {
          this.alpha -= this.decay;
        }
      } else if (!isExploded) {
        this.vx *= 0.999;
        this.vy *= 0.999;
      }

      if (!isExploded || this.isExplosionParticle) {
        // Check collisions with box walls
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
      explosionProgress++;
      const explosionSize = explosionProgress / explosionDuration;
      const maxDistort = 30;

      // Draw exploding box
      ctx.save();
      ctx.strokeStyle = `hsl(${explosionProgress * 2}, 100%, 50%)`;
      ctx.lineWidth = 3;
      ctx.beginPath();

      // Distorted rectangle for explosion effect
      const distortX = maxDistort * Math.sin(explosionProgress * 0.2);
      const distortY = maxDistort * Math.cos(explosionProgress * 0.15);

      ctx.moveTo(boxX - distortX, boxY - distortY);
      ctx.lineTo(boxX + boxWidth + distortX, boxY - distortY);
      ctx.lineTo(boxX + boxWidth + distortX * 0.7, boxY + boxHeight + distortY);
      ctx.lineTo(boxX - distortX * 0.7, boxY + boxHeight + distortY);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();

      if (explosionProgress >= explosionDuration) {
        isExploding = false;
        explosionProgress = 0;
      }
    } else if (!isExploded) {
      // Draw normal box
      ctx.strokeStyle = '#4361ee';
      ctx.lineWidth = 3;
      ctx.setLineDash([]);
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

    maxVolumeBeforeExplosion = containerVolume;
    pressureAtExplosion = pressure;
    particlesAtExplosion = particles.length;

    // Update explosion stats display
    document.getElementById('maxVolumeValue').textContent = maxVolumeBeforeExplosion.toFixed(4);
    document.getElementById('explosionPressureValue').textContent = pressureAtExplosion.toFixed(1);
    document.getElementById('explosionParticlesValue').textContent = particlesAtExplosion;
    document.getElementById('explosionStats').style.display = 'block';

    // Add explosion particles
    const centerX = boxX + boxWidth / 2;
    const centerY = boxY + boxHeight / 2;
    const explosionPower = Math.min(30, Math.max(5, pressure / 50));

    // Convert existing particles to explosion particles
    particles.forEach((p) => {
      const dx = p.x - centerX;
      const dy = p.y - centerY;
      const distance = Math.max(0.1, Math.sqrt(dx * dx + dy * dy));
      const force = explosionPower * (1 + Math.random() * 0.5);
      p.vx = (dx / distance) * force;
      p.vy = (dy / distance) * force - 2;
      p.color = `hsl(${Math.random() * 60}, 100%, 50%)`;
      p.isExplosionParticle = true;
      p.alpha = 1;
      p.decay = 0.01 + Math.random() * 0.02;
    });

    // Add additional explosion particles
    for (let i = 0; i < 50; i++) {
      const p = new Particle(centerX, centerY, true);
      p.alpha = 1;
      p.decay = 0.01 + Math.random() * 0.02;
      explosionParticles.push(p);
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
        <div class="pressure-warning" style="margin-top: 8px; padding: 8px; background-color: rgba(231, 76, 60, 0.1); border-radius: 4px; border-left: 3px solid #e74c3c;">
            <strong style="color: #e74c3c;">${pressure > maxPressure ? 'EXPLODED!' : 'WARNING:'}</strong>
            <span style="color: #e74c3c;">
                Pressure is at ${(pressureRatio * 100).toFixed(0)}% of container strength!
            </span>
            ${pressure > maxPressure
          ? "<div style='margin-top: 4px;'>The container couldn't withstand the pressure and ruptured!</div>"
          : ''
        }
        </div>
      `;
    }

    explanationElement.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
          <div style="font-size: 1.5rem; color: var(--primary);">PV = nRT</div>
          <div style="flex-grow: 1; border-top: 1px dashed var(--border);"></div>
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
              <div style="font-size: 0.85rem; color: var(--text-secondary)">
                  (Max: ${maxPressure} kPa)
              </div>
          </div>
      </div>
      
      ${warningMessage}
      
      <div style="margin-top: 8px; font-size: 0.85rem; color: var(--text-secondary)">
          <strong>Experiment:</strong> Try changing temperature, adding particles, or changing the container strength to see how pressure changes.
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
    document.getElementById('boxWidthValue').textContent = boxWidth;
    document.getElementById('boxHeightValue').textContent = boxHeight;

    document.getElementById('pressureValue').textContent = STANDARD_PRESSURE.toFixed(1);
    document.getElementById('pressureValue').style.color = '#3498db';
    document.getElementById('explosionStats').style.display = 'none';

    resizeCanvas();
    updateGasLawExplanation();
  }

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw the container box
    drawBox();

    if (!isExploded) {
      handleCollisions();
    }

    particles.forEach((p) => {
      p.update();
      p.draw();
    });

    for (let i = particles.length - 1; i >= 0; i--) {
      particles[i].update();
      particles[i].draw();

      if (particles[i].isFinished && particles[i].isFinished()) {
        particles.splice(i, 1);
      }
    }

    for (let i = explosionParticles.length - 1; i >= 0; i--) {
      explosionParticles[i].update();
      explosionParticles[i].draw();

      if (explosionParticles[i].isFinished()) {
        explosionParticles.splice(i, 1);
      }
    }

    requestAnimationFrame(animate);
  }

  // Helper function for explosion sound
  function playExplosionSound() {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(150, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(1, audioContext.currentTime + 0.8);

      gainNode.gain.setValueAtTime(0.6, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.8);

      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.8);
    } catch (e) {
      console.log('AudioContext not supported or error playing sound:', e);
    }
  }

  // Event listeners
  document.getElementById('boxWidth').addEventListener('input', function () {
    boxWidth = parseInt(this.value);
    document.getElementById('boxWidthValue').textContent = boxWidth;
    resizeCanvas();
  });

  document.getElementById('boxHeight').addEventListener('input', function () {
    boxHeight = parseInt(this.value);
    document.getElementById('boxHeightValue').textContent = boxHeight;
    resizeCanvas();
  });

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
  animate();
});