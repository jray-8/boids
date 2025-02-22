// Based on the implementation of the rules found at:
// https://people.ece.cornell.edu/land/courses/ece4760/labs/s2021/Boids/Boids.html#Algorithm-Overview

import Vector from './vector.js';

const canvas = document.getElementById('boids-canvas');
const canvasContainer = document.getElementById('canvas-container');

/** @type {CanvasRenderingContext2D} */
const ctx = canvas.getContext('2d');
const canvasHeight = 600;
let canvasWidth = null; // scale to match canvas element aspect ratio

function resizeCanvas() {
	// Get the display size aspect ratio (on screen)
	const r = canvas.clientWidth / canvas.clientHeight;

	// Set virtual resolution (drawing space)
	canvas.width = canvasHeight * r;
	canvas.height = canvasHeight;

	// Store
	canvasWidth = canvas.width;
	// console.log(canvasWidth, canvasHeight); //!
}

resizeCanvas();
window.addEventListener('resize', resizeCanvas);

function getRandomPosition() {
	return [Math.random() * canvasWidth, Math.random() * canvasHeight];
}


// #region Boid Settings 
const Shape = {
	CIRCLE: 0,
	TRIANGLE: 1
};

class BoidType {
	constructor(name, color, settings) {
		this.name = name;
		this.color = color;
		this.settings = settings; // All editable settings will go into this object
	}

	// Define the min, max, and stepSize for each input setting
	static settingsConstraints = {
		size: 				{ min: 5, 		max: 25, 	stepSize: 1 	},
		shape:				{ min: 0,		max: 1,		stepSize: 1 	},
		flockSize:			{ min: 0,		max: 50,	stepSize: 1 	},
		minSpeed: 			{ min: 0, 		max: 0.8, 	stepSize: 0.01 	},
		maxSpeed: 			{ min: 0.1, 	max: 2, 	stepSize: 0.01 	},
		perceptionRadius: 	{ min: 20, 		max: 100, 	stepSize: 1 	},
		evasionFov: 		{ min: 0, 		max: 360, 	stepSize: 5 	},
		turnFactor: 		{ min: 0, 		max: 2, 	stepSize: 0.1 	},
		separationRadius: 	{ min: 10, 		max: 50, 	stepSize: 1 	},
		separationWeight: 	{ min: 0, 		max: 2, 	stepSize: 0.1 	},
		alignmentWeight: 	{ min: 0, 		max: 2, 	stepSize: 0.1 	},
		cohesionWeight: 	{ min: 0, 		max: 2, 	stepSize: 0.1 	},
		anchorRadius: 		{ min: 0, 		max: 100, 	stepSize: 1 	},
		anchoredCohesion: 	{ min: 0, 		max: 2, 	stepSize: 0.1 	}
	};

	// Define the order (top-down) for settings in the input groups
	static settingsOrder = [
		'size',
		'shape',
		'flockSize',

		'minSpeed',
		'maxSpeed',
		'turnFactor',
		
		'separationRadius',
		'perceptionRadius',
		'evasionFov',

		'separationWeight',
		'alignmentWeight',
		'cohesionWeight',

		'anchorRadius',
		'anchoredCohesion'
	];

	// Settings that should be multiplied by the height constant
	static percentHeightSettings = ['minSpeed', 'maxSpeed', 'turnFactor'];
}

// Create five different boid types with unique parameters
const boidTypes = [
	new BoidType('Red', '#ff0000', {
		size: 10,
		shape: Shape.TRIANGLE,
		flockSize: 5,
		minSpeed: 0.3,
		maxSpeed: 0.3,
		perceptionRadius: 100,
		evasionFov: 360,
		turnFactor: 0.15,
		separationRadius: 50,
		separationWeight: 1.0,
		alignmentWeight: 1.0,
		cohesionWeight: 1.0,
		anchorRadius: 50,
		anchoredCohesion: 1.0
	}),
	new BoidType('Yellow', '#ffff00', {
		size: 16,
		shape: Shape.TRIANGLE,
		flockSize: 40,
		minSpeed: 0.8,
		maxSpeed: 2.0,
		perceptionRadius: 60,
		evasionFov: 120,
		turnFactor: 0.10,
		separationRadius: 40,
		separationWeight: 1.5,
		alignmentWeight: 1,
		cohesionWeight: 0.5,
		anchorRadius: 50,
		anchoredCohesion: 1.0
	}),
	new BoidType('Blue', '#0000ff', {
		size: 5,
		shape: Shape.TRIANGLE,
		flockSize: 20,
		minSpeed: 1.4,
		maxSpeed: 3.5,
		perceptionRadius: 30,
		evasionFov: 360,
		turnFactor: 0.20,
		separationRadius: 7,
		separationWeight: 1,
		alignmentWeight: 1.5,
		cohesionWeight: 1.3,
		anchorRadius: 50,
		anchoredCohesion: 1.0
	}),
	new BoidType('Green', '#00ff00', {
		size: 12,
		shape: Shape.TRIANGLE,
		flockSize: 2,
		minSpeed: 2.5,
		maxSpeed: 5.0,
		perceptionRadius: 40,
		evasionFov: 80,
		turnFactor: 0.10,
		separationRadius: 15,
		separationWeight: 0.8,
		alignmentWeight: 1.6,
		cohesionWeight: 1.0,
		anchorRadius: 50,
		anchoredCohesion: 1.0
	}),
	new BoidType('White', '#ffffff', {
		size: 10,
		shape: Shape.CIRCLE,
		flockSize: 30,
		minSpeed: 1.0,
		maxSpeed: 3.0,
		perceptionRadius: 15,
		evasionFov: 180,
		turnFactor: 0.08,
		separationRadius: 5,
		separationWeight: 0.2,
		alignmentWeight: 0.5,
		cohesionWeight: 0.5,
		anchorRadius: 50,
		anchoredCohesion: 0
	}),
];
// #endregion


// #region Boids 
class Flock {
	constructor(boidType) {
		this.members = []; 			// All boids in this flock
		this.boidType = boidType; 	// Unique characteristics of the boids in this flock
		this.active = false;		// This flock is selected on the settings panel
	}

	addBoid() {
		const [x, y] = getRandomPosition();
		this.members.push(new Boid(x, y, this.boidType));
	}

	getFlockSize() {
		return this.members.length;
	}

	/** Add or remove boids until the flock size matches the boidType.settings */
	updateMembers() {
		const capacity = this.boidType.settings.flockSize;
		while (this.members.length > capacity) {
			this.members.pop();
		}
		while (this.members.length < capacity) {
			this.addBoid();
		}
	}

	/** Give boids new random positions and velocities */
	scatter() {
		for (let i=0; i < this.members.length; ++i) {
			this.members[i].randomizePosition();
			this.members[i].randomizeVelocity();
		}
	}
}


class Boid {
	constructor(x, y, boidType) {
		this.position = new Vector(x, y);

		// Easy access to unique attributes
		this.boidType = boidType;
		
		// Velocity starts with a random direction
		this.randomizeVelocity();
	}

	/** Give boid random velocity direction with magnitude of its min speed */
	randomizeVelocity() {
		this.velocity = new Vector(Math.random() * 2 - 1, Math.random() * 2 - 1); // x, y in [-1, 1)
		this.velocity.normalize();
		this.velocity.multiply(this.boidType.settings.minSpeed);
	}

	randomizePosition() {
		const [x, y] = getRandomPosition();
		this.position = new Vector(x, y);
	}

	draw() {
		if (this.boidType.settings.shape === Shape.TRIANGLE) {
			this.drawTriangle();
		}
		else {
			this.drawCircle();
		}
	}

	/** Add this boid to the canvas as a colored circle */
	drawCircle() {
		const size = this.boidType.settings.size;
		ctx.beginPath();
		ctx.arc(this.position.x, this.position.y, size, 0, 2 * Math.PI);
		ctx.fillStyle = this.boidType.color;
		ctx.fill();
	}

	/** Add this boid to the canvas as a colored, isosceles triangle */
	drawTriangle() {
		const angle = Math.atan2(this.velocity.y, this.velocity.x);
		const cosA = Math.cos(angle);
		const sinA = Math.sin(angle);

		// Triangle size
		const frontSize = this.boidType.settings.size;
		const backSize = frontSize * 0.6;

		// Calculate points
		const tipX = this.position.x + cosA * frontSize;
		const tipY = this.position.y + sinA * frontSize;
		
		// -90 degree rotation [x,y] -> [y,-x]
		const leftX = this.position.x - cosA * backSize + sinA * backSize;
		const leftY = this.position.y - sinA * backSize - cosA * backSize;

		// 90 degree rotation [x,y] -> [-y,x]
		const rightX = this.position.x - cosA * backSize - sinA * backSize;
		const rightY = this.position.y - sinA * backSize + cosA * backSize;

		// Draw triangle
		ctx.beginPath();
		ctx.moveTo(tipX, tipY);
		ctx.lineTo(leftX, leftY);
		ctx.lineTo(rightX, rightY);
		ctx.closePath();

		ctx.fillStyle = this.boidType.color;
		ctx.fill();
	}

	updatePosition(deltaTime) {
		// Update position
		const deltaPos = this.velocity.clone();
		deltaPos.multiply(deltaTime);
		this.position.add(deltaPos);
	}

	/** Compute all forces currently acting on this boid.  
	 * 
	 * The resulting force will be used to update the boid's velocity (restricted by its max and min speed boundaries).
	 */
	updateForces(flock, activeFlock) {
		// Add forces from neighboring boids
		const totalForce = this.getFlockForce(flock, activeFlock);
		
		// Add edge handling forces
		totalForce.add(this.getEdgeForce());

		// Add attraction to an anchor point
		if (activeFlock && anchorPosition != null) {
			totalForce.add(this.seek(anchorPosition));
		}

		// Apply forces to velocity
		this.velocity.add(totalForce);

		// Limit speed
		const maxSpeed = this.boidType.settings.maxSpeed;
		const minSpeed = this.boidType.settings.minSpeed;
		this.velocity.upperLimit(maxSpeed);
		this.velocity.lowerLimit(minSpeed);
	}

	/** Return force to attract boid towards a target position */
	seek(target) {
		const delta = new Vector(target.x - this.position.x, target.y - this.position.y);
		const range = this.boidType.settings.anchorRadius;
		// Within close enough range of anchor
		if (delta.magnitude() < range) {
			delta.zero(); // Do not seek
		}
		return delta;
	}

	/** Returns the force to bring boids back on screen */
	getEdgeForce() {
		const margin = 25;
		const edgeForce = new Vector(0, 0);
	
		// Horizontal edges
		if (this.position.x < margin) {
			edgeForce.x += 1;
		} 
		else if (this.position.x > canvasWidth - margin) {
			edgeForce.x -= 1;
		}

		// Vertical edges
		if (this.position.y < margin) {
			edgeForce.y += 1;
		} 
		else if (this.position.y > canvasHeight - margin) {
			edgeForce.y -= 1;
		}
	
		// Apply edge force
		const turnFactor = this.boidType.settings.turnFactor;
		edgeForce.normalize();
		edgeForce.multiply(turnFactor);
		return edgeForce;
	}

	// Separation: boids move away from boids that are too close
	// Alignment: boids attempt to match the velocities of their neighbors
	// Cohesion: boids move towards the center of mass of their neighbors

	/** Returns the total force resulting from separation, alignment and cohesion acting on this boid */
	getFlockForce(flock, activeFlock) {
		const separationForce = new Vector(0, 0);
		const alignmentForce = new Vector(0, 0);
		const cohesionForce = new Vector(0, 0);		

		// Steer away from boids in this radius
		const protectedRange = this.boidType.settings.separationRadius;

		// Align and move towards the COM of boids in this radius
		const visibleRange = this.boidType.settings.perceptionRadius;

		// Field of View in degrees
		const fov = this.boidType.settings.evasionFov;

		let neighboringBoids = 0;

		for (let i=0; i < flock.length; ++i) {
			const otherboid = flock[i];
			if (otherboid === this) continue; // Self does not contribute to its own flock forces

			const distance = Vector.distance(this.position, otherboid.position);
			if (distance > visibleRange) continue; // Cannot see (do not consider)

			// Separation
			if (distance < protectedRange) {
				const diff = new Vector(this.position.x - otherboid.position.x, this.position.y - otherboid.position.y);
				const m = diff.magnitude();
				if (m > 0) {
					diff.multiply((protectedRange - m) / m);
					separationForce.add(diff);
				}
			}

			// Alignment & Cohesion
			alignmentForce.add(otherboid.velocity);
			cohesionForce.add(otherboid.position);
			++neighboringBoids;

			// V-Formation (vision obstruction)
			const toOther = new Vector(
				otherboid.position.x - this.position.x, 
				otherboid.position.y - this.position.y
			);

			const angle = Vector.angleBetween(this.velocity, toOther);

			// Within FOV
			if (angle * 2 < fov) {
			}
		}

		// Average and get delta
		// Note: Separation forces accumulate so we do not average them
		if (neighboringBoids > 0) {
			alignmentForce.divide(neighboringBoids);
			cohesionForce.divide(neighboringBoids);

			alignmentForce.subtract(this.velocity); // Subtract own velocity
			cohesionForce.subtract(this.position); // Subtract own position
		}

		// Apply weights and sum forces:
		const combinedForce = new Vector(0, 0);

		// Separation
		const separationWeight = this.boidType.settings.separationWeight;
		separationForce.multiply(separationWeight);
		combinedForce.add(separationForce);

		// Alignment -- boids do not align when anchored
		if (!activeFlock || anchorPosition == null) {
			const alignmentWeight = this.boidType.settings.alignmentWeight;
			alignmentForce.multiply(alignmentWeight);
			combinedForce.add(alignmentForce);	
		}

		// Cohesion -- boids use different COM weight anchored
		if (!activeFlock || anchorPosition == null) {
			const cohesionWeight = this.boidType.settings.cohesionWeight;
			cohesionForce.multiply(cohesionWeight);
			combinedForce.add(cohesionForce);
		}
		else { // Anchored
			const anchoredCohesion = this.boidType.settings.anchoredCohesion;
			cohesionForce.multiply(anchoredCohesion);
			combinedForce.add(cohesionForce);
		}

		return combinedForce;
	}
}
// #endregion


// #region Anchor 
// Attract boids to this location
let anchorPosition = null;
let isTracking = false; // Continuously update the anchor
let mouseDown = false;

/** Stop tracking & clear anchor position */
function clearAnchor() {
	anchorPosition = null;
	isTracking = false;
	mouseDown = false;
}

/** Sets the new anchor position based on the mouse's location 
 * 
 * @param event - The mouse event triggered by the user action
*/
function updateAnchor(event) {
	const rect = canvas.getBoundingClientRect();
	const x = canvasWidth * (event.clientX - rect.left) / canvas.clientWidth;
	const y = canvasHeight * (event.clientY - rect.top) / canvas.clientHeight;
	anchorPosition = {x, y};
}

function drawAnchor() {
	if (anchorPosition != null) {
		ctx.beginPath();
		ctx.arc(anchorPosition.x, anchorPosition.y, 3, 0, 2 * Math.PI); // Size 5 for a small dot
		ctx.fillStyle = 'pink';
		ctx.fill();
	}
}

// Handle mouse events
document.addEventListener('mousedown', (e) => {
	if (e.button !== 0 || e.target !== canvas) return;

	// Left-click on canvas
	mouseDown = true;
	updateAnchor(e);
});

document.addEventListener('mousemove', (e) => {
	if (mouseDown || isTracking) {
		const rect = canvas.getBoundingClientRect();

		// Outside canvas area -- stop tracking
		if (e.clientX < rect.left || e.clientX > rect.right) {
			clearAnchor();
		}
		else if (e.clientY < rect.top || e.clientY > rect.bottom) {
			clearAnchor();
		}
		// Inside canvas area -- continue tracking
		else {
			updateAnchor(e);
		}
	}
});

document.addEventListener('mouseup', () => {
	mouseDown = false; // Stop tracking, but keep anchor point
});

// Toggle tracking mode on double click
canvas.addEventListener('dblclick', () => {
	if (isTracking) {
		clearAnchor();
	}
	else {
		isTracking = true;
	}
});

// Clicking outside canvas clears anchor
canvasContainer.addEventListener('click', (e) => {
	if (e.target !== canvas) {
		clearAnchor();
	}
});

// Pressing ESC clears anchor
document.addEventListener('keydown', (e) => {
	if (e.target.tagName === 'INPUT') return; // Ignore if typing in input
	if (e.code === 'Escape') {
		clearAnchor();
	}
});
// #endregion


// #region Animation 
function startSimulation(allFlocks) {
	let lastTime = performance.now(); 	// Reset lastTime to avoid deltaTime jumps
	let isPaused = false; 				// Track whether simulation is paused
	let solo = false;					// Focus only on active flock 

	function gameLoop(timestamp) {
		if (isPaused) return;
	
		const deltaTime = (timestamp - lastTime) / 1000; // Time difference in seconds
		lastTime = timestamp;

		// Clear canvas
		ctx.clearRect(0, 0, canvasWidth, canvasHeight);
		
		drawAnchor(); // Draw anchor if it's set

		for (let k = 0; k < 1; ++k) {
			const flock = allFlocks[k];
			const boids = flock.members;

			// Update & apply forces -- velocity and position of each boid
			for (let i = 0; i < boids.length; ++i) {
				boids[i].updateForces(boids, flock.active);
				boids[i].updatePosition(deltaTime);

				// Draw boid
				boids[i].draw();
			}
		}
	
		requestAnimationFrame(gameLoop);
	}

	gameLoop(lastTime); // Start loop

	// Reset lastTime when the tab becomes visible again
	document.addEventListener('visibilitychange', () => {
		if (!document.hidden) {
			lastTime = performance.now();
		}
	});

	// Simulation controller object
	const simControls = {
		togglePause() { 
			isPaused = !isPaused;
			if (!isPaused) {
				lastTime = performance.now();
				gameLoop(lastTime);
			}
		},

		/** Only draw and update the active flock, or all if toggled off */
		toggleSolo() {
			solo = !solo;
		}
	}
	return simControls;
}
// #endregion


// Exports
export { Flock, BoidType, startSimulation, boidTypes, canvasHeight };