// Based on the implementation of the rules found at:
// https://people.ece.cornell.edu/land/courses/ece4760/labs/s2021/Boids/Boids.html#Algorithm-Overview

import Vector from './vector.js';

const canvas = document.getElementById('boids-canvas');
const canvasContainer = document.getElementById('canvas-container');

/** @type {CanvasRenderingContext2D} */
const ctx = canvas.getContext('2d');
const canvasHeight = 600; //$
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

	/* Define the min, max, and stepSize for each input setting
	 *
	 * minSpeed is implicitly capped at maxSpeed
	 * 
	 * separationRadius also contributes to magnitude of separation vector
	 * if turnFactor is 0, boids leave the field indefinitely
	*/
	static settingsConstraints = {
		size: 				{ min: 3, 		max: 25, 	stepSize: 1 	},
		shape:				{ min: 0,		max: 1,		stepSize: 1 	},
		flockSize:			{ min: 0,		max: 30,	stepSize: 1 	},
		minSpeed: 			{ min: 0, 		max: 480, 	stepSize: 5 	},
		maxSpeed: 			{ min: 60, 		max: 900, 	stepSize: 5 	},
		turnFactor: 		{ min: 0, 		max: 900, 	stepSize: 5 	},
		perceptionRadius: 	{ min: 20, 		max: 150, 	stepSize: 5 	},
		separationRadius: 	{ min: 10, 		max: 100, 	stepSize: 5 	},
		separationWeight: 	{ min: 0, 		max: 2, 	stepSize: 0.1 	},
		alignmentWeight: 	{ min: 0, 		max: 2, 	stepSize: 0.1 	},
		cohesionWeight: 	{ min: 0, 		max: 2, 	stepSize: 0.1 	},
		anchorRadius: 		{ min: 0, 		max: 100, 	stepSize: 5 	},
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
		
		'perceptionRadius',
		'separationRadius',

		'separationWeight',
		'alignmentWeight',
		'cohesionWeight',

		'anchorRadius',
		'anchoredCohesion'
	];

	// Settings that should be retrieved as floats
	static floatSettings = [
		'separationWeight',
		'alignmentWeight',
		'cohesionWeight',
		'anchoredCohesion'
	];
}

// Create five different boid types with unique parameters
const boidTypes = [
	new BoidType('Red', '#ff2323', {
		size: 8,
		shape: Shape.TRIANGLE,
		flockSize: 7,
		minSpeed: 180,
		maxSpeed: 180,
		turnFactor: 90,
		perceptionRadius: 100,
		separationRadius: 50,
		separationWeight: 1.0,
		alignmentWeight: 1.0,
		cohesionWeight: 1.0,
		anchorRadius: 25,
		anchoredCohesion: 1.0
	}),
	new BoidType('Yellow', '#faca2a', {
		size: 16,
		shape: Shape.TRIANGLE,
		flockSize: 25,
		minSpeed: 40,
		maxSpeed: 110,
		turnFactor: 3,
		perceptionRadius: 150,
		separationRadius: 100,
		separationWeight: 0.2,
		alignmentWeight: 1,
		cohesionWeight: 0,
		anchorRadius: 40,
		anchoredCohesion: 0
	}),
	new BoidType('Blue', '#2f90ff', {
		size: 3,
		shape: Shape.TRIANGLE,
		flockSize: 20,
		minSpeed: 150,
		maxSpeed: 230,
		turnFactor: 120,
		perceptionRadius: 100,
		separationRadius: 10,
		separationWeight: 1,
		alignmentWeight: 0,
		cohesionWeight: 1,
		anchorRadius: 0,
		anchoredCohesion: 2
	}),
	new BoidType('Green', '#2dff2d', {
		size: 10,
		shape: Shape.TRIANGLE,
		flockSize: 2,
		minSpeed: 220,
		maxSpeed: 600,
		turnFactor: 50,
		perceptionRadius: 85,
		separationRadius: 45,
		separationWeight: 1.5,
		alignmentWeight: 0.03,
		cohesionWeight: 2,
		anchorRadius: 50,
		anchoredCohesion: 0
	}),
	new BoidType('White', '#e0e0e0', {
		size: 4,
		shape: Shape.CIRCLE,
		flockSize: 11,
		minSpeed: 90,
		maxSpeed: 150,
		turnFactor: 30,
		perceptionRadius: 20,
		separationRadius: 30,
		separationWeight: 1,
		alignmentWeight: 1.2,
		cohesionWeight: 0,
		anchorRadius: 100,
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
		const deltaPos = this.velocity.clone();
		deltaPos.multiply(deltaTime);
		this.position.add(deltaPos);
	}

	/** Compute all forces currently acting on this boid.  
	 * 
	 * The resulting force will be used to update the boid's velocity (restricted by its max and min speed boundaries).
	 */
	updateForces(flock, collidableBoids) {
		// Add forces from neighboring boids
		const totalForce = this.getFlockForce(flock);

		// Add forces from separation
		totalForce.add(this.getSeparationForce(collidableBoids));
		
		// Add edge handling forces
		totalForce.add(this.getEdgeForce());

		// Add attraction to an anchor point
		if (flock.active && anchorPosition != null) {
			totalForce.add(this.seek(anchorPosition));
		}

		// Apply forces to velocity
		this.velocity.add(totalForce);

		// Limit speed -- Max speed takes precedence over min speed
		const maxSpeed = this.boidType.settings.maxSpeed;
		const minSpeed = this.boidType.settings.minSpeed;
		this.velocity.lowerLimit(minSpeed);
		this.velocity.upperLimit(maxSpeed);
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
		const margin = 25; //$
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

	/** Returns the force that repels boids from other boids 
	 * 
	 * @param boids - An array of Boids to consider for repulsion
	*/
	getSeparationForce(boids) {
		const separationForce = new Vector(0, 0);

		// Steer away from boids in this radius
		const protectedRange = this.boidType.settings.separationRadius;

		for (let i=0; i < boids.length; ++i) {
			const otherBoid = boids[i];
			if (otherBoid === this) continue; // Skip itself

			const distance = Vector.distance(this.position, otherBoid.position);

			// Separation
			if (distance < protectedRange) {
				// Vector from other boid to this one (push away)
				const toSelf = new Vector(this.position.x - otherBoid.position.x, this.position.y - otherBoid.position.y);
				const m = toSelf.magnitude();
				if (m > 0) {
					// Invert magnitude: closer boids yield a greater magnitude (capped at protectedRange)
					toSelf.multiply((protectedRange - m) / m);
					separationForce.add(toSelf);
				}
			}
		}
		// Note: Separation forces accumulate so we do not average them

		// Scale by weight
		const separationWeight = this.boidType.settings.separationWeight;
		separationForce.multiply(separationWeight);

		return separationForce;
	}

	// Alignment: boids attempt to match the velocities of their neighbors
	// Cohesion: boids move towards the center of mass of their neighbors

	/** Returns the total force resulting from alignment and cohesion acting on this boid */
	getFlockForce(flock) {
		const alignmentForce = new Vector(0, 0);
		const cohesionForce = new Vector(0, 0);

		// Align and move towards the COM of boids in this radius
		const visibleRange = this.boidType.settings.perceptionRadius;

		let neighboringBoids = 0;

		for (let i=0; i < flock.members.length; ++i) {
			const otherBoid = flock.members[i];
			if (otherBoid === this) continue; // Self does not contribute to its own flock forces

			const distance = Vector.distance(this.position, otherBoid.position);
			if (distance > visibleRange) continue; // Cannot see (do not consider)

			// Alignment & Cohesion
			alignmentForce.add(otherBoid.velocity);
			cohesionForce.add(otherBoid.position);
			++neighboringBoids;
		}

		// Average and get delta
		if (neighboringBoids > 0) {
			alignmentForce.divide(neighboringBoids);
			cohesionForce.divide(neighboringBoids);

			alignmentForce.subtract(this.velocity); // Subtract own velocity
			cohesionForce.subtract(this.position); // Subtract own position
		}

		// Apply weights and sum forces:
		const combinedForce = new Vector(0, 0);

		// Alignment -- boids do not align when anchored
		if (!flock.active || anchorPosition == null) {
			const alignmentWeight = this.boidType.settings.alignmentWeight;
			alignmentForce.multiply(alignmentWeight);
			combinedForce.add(alignmentForce);	
		}

		// Cohesion -- boids use different COM weight anchored
		if (!flock.active || anchorPosition == null) {
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
	let solo = false;					// Update only on active flock
	let collisions = false;				// Will boids separate from boids in other flocks?

	// Precompute reference list for all boids
	const allBoids = allFlocks.flatMap(flock => flock.members);

	function gameLoop(timestamp) {
		if (isPaused) return;
	
		const deltaTime = (timestamp - lastTime) / 1000; // Time difference in seconds
		lastTime = timestamp;

		// Clear canvas
		ctx.clearRect(0, 0, canvasWidth, canvasHeight);
		
		drawAnchor(); // Draw anchor if it's set

		for (const flock of allFlocks) {

			// If solo mode is enabled, skip all non-active flocks
			if (solo && !flock.active) continue;

			// Consider all boids, or own flock, for collisions
			const collidableBoids = (collisions && !solo) ? allBoids : flock.members;

			const boids = flock.members;

			// Update & apply forces -- velocity and position of each boid
			for (const boid of boids) {
				boid.updateForces(flock, collidableBoids);
				boid.updatePosition(deltaTime);
				boid.draw(); // Update canvas
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
		/** Stop updates to physics and drawing */
		togglePause() { 
			isPaused = !isPaused;
			if (!isPaused) {
				lastTime = performance.now();
				gameLoop(lastTime);
			}
		},

		/** Only draw and update the active flock, or all if toggled off */
		toggleSolo: () => solo = !solo,

		/** Determines whether boids interact with boids from other flocks (or only their own) */
		toggleCollisions: () => collisions = !collisions
	}
	return simControls;
}
// #endregion


// Exports
export { Flock, BoidType, startSimulation, boidTypes, canvasHeight };