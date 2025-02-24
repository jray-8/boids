
import { Flock, BoidType, startSimulation, boidTypes, canvasHeight } from './boids.js';

// Settings panel groups
const tabButtonsContainer = document.getElementById('tab-buttons');
const tabsContainer = document.getElementById('tabs');
let activeIndex = 0;

// Simulation controller object
let sim = null;

// Store all different groups of boids
const allFlocks = Array.from(boidTypes, type => new Flock(type));

for (let i=0; i < allFlocks.length; ++i) {
	allFlocks[i].updateMembers();
}


// Create an input group (div) for a given setting
function createInputGroup(settingName, boidSettings) {
	const group = document.createElement('div');
	group.classList.add('setting-group');

	const label = document.createElement('label');

	// Format the setting name (camelCase -> 'My Parameter')
	label.textContent = settingName.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (str) => str.toUpperCase());

	// Numeric input box
	const input = document.createElement('input');
	input.type = 'number';
	const constraints = BoidType.settingsConstraints[settingName];
	input.min = constraints.min;
	input.max = constraints.max;
	input.step = constraints.stepSize;
	input.value = boidSettings[settingName]; // Default value

	// Tooltip
	input.title = `Enter a value between ${constraints.min} and ${constraints.max}`;

	// Update setting based on input value
	function updateSetting() {
		let newValue = parseFloat(input.value);
		if (!BoidType.floatSettings.includes(settingName)) {
			newValue = parseInt(newValue);
		}

		if (!isNaN(newValue)) {
			// Restrict range
			newValue = Math.max(constraints.min, Math.min(constraints.max, newValue));
			input.value = newValue;
			boidSettings[settingName] = newValue;

			// Update flock members
			if (settingName === 'flockSize') {
				allFlocks[activeIndex].updateMembers();
			}
		}
		// Reset to last valid value
		else {
			input.value = boidSettings[settingName];
		}
	}

	// Update boid setting when input changes
	input.addEventListener('change', updateSetting);

	updateSetting(); // Read and convert the default value from input
	group.appendChild(label);
	group.appendChild(input);
	return group;
}

// For name of boids
function createNameLabel(name) {
	const group = document.createElement('div');
	group.classList.add('setting-group');
	
	const label = document.createElement('label');
	label.textContent = name + ' Boids';
	label.classList.add('boid-name');
	label.classList.add(name.toLowerCase());

	group.appendChild(label);
	return group;
}


// Button to switch settings tab
function createTabButton(boidType, index) {
	const button = document.createElement('button');
	button.textContent = ''; // Empty text content
	button.classList.add(boidType.name.toLowerCase()); // Color class

	button.title = `${boidType.name} Boids (${index + 1})`; // Tooltip text
	button.setAttribute('aria-label', `${boidType.name} Boids`); // For accessibility

	if (index === activeIndex) {
		button.classList.add('active'); // Mark the first button as active
		allFlocks[index].active = true;
	}
	return button;
}

// Tab content (settings) for each boid type
function createTabContent(boidType, index) {
	const tabContent = document.createElement('div');
	tabContent.classList.add('tab-content');
	if (index === activeIndex) tabContent.classList.add('active'); // Set the first tab content as active

	// Name of this boid type
	const nameLabel = createNameLabel(boidType.name);
	tabContent.appendChild(nameLabel);

	// For each boid setting, add an input field
	BoidType.settingsOrder.forEach((key) => {
		if (boidType.settings.hasOwnProperty(key)) {
			const inputGroup = createInputGroup(key, boidType.settings);
			tabContent.appendChild(inputGroup);
		}
	});

	return tabContent;
}


// Main function to initialize the settings tabs
function initSettingsPanel() {

	// Create and append buttons and tab content for each boid type
	boidTypes.forEach((type, index) => {
		const button = createTabButton(type, index);
		const tabContent = createTabContent(type, index);

		tabButtonsContainer.appendChild(button);
		tabsContainer.appendChild(tabContent);

		// Event listener for tab switching
		button.addEventListener('click', () => switchTab(index));
	});
}

// Make a new settings page active
function switchTab(index) {
	activeIndex = index;

	const buttons = tabButtonsContainer.children;
	const tabs = tabsContainer.children;

	// Activate the correct button and tab, deactivate the others
	for (let i=0; i < buttons.length; ++i) {
		buttons[i].classList.remove('active');
		tabs[i].classList.remove('active');
	}
	buttons[index].classList.add('active');
	tabs[index].classList.add('active');

	// Make a new flock active
	for (let i=0; i < allFlocks.length; ++i) {
		allFlocks[i].active = false;
	}
	allFlocks[index].active = true;
}

// Key controls
const keysPressed = {};

document.addEventListener('keydown', (event) => {
	if (keysPressed[event.code]) return; // Prevent continuous trigger

	keysPressed[event.code] = true;

	switch (event.code) {
		case 'Escape':
			document.activeElement.blur(); // Remove focus from any selected button/input
			return;
		case 'Space':
			event.preventDefault(); // Do not scroll bar (for instance)
			if (event.target.tagName !== 'INPUT') sim.togglePause();
			return;
		case 'KeyR':
			allFlocks[activeIndex].scatter();
			return;
		case 'KeyS':
			if (sim) sim.toggleSolo();
			return;
	}

	// Ignore if typing in input
	if (event.target.tagName === 'INPUT') return;

	// Switch tabs based on number keys (index in boidTypes)
	if (event.key >= 1 && event.key <= boidTypes.length) {
		event.target.blur();
		const index = event.key - 1;
		switchTab(index);
	}
});

document.addEventListener('keyup', (event) => {
	keysPressed[event.code] = false;
});


// Initialize settings tabs
initSettingsPanel();

// Start the simulation
sim = startSimulation(allFlocks);