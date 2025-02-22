export default class Vector {
	constructor(x, y) {
		this.x = x;
		this.y = y;
	}

	static distance(v1, v2) {
		return Math.sqrt((v2.x - v1.x) ** 2 + (v2.y - v1.y) ** 2);
	}

	/** Returns the angle (in degrees) between two vectors */
	static angleBetween(v1, v2) {
		// v1 dot v2 = cos(theta) * |v1| * |v2|
		const dotProduct = (v1.x * v2.x) + (v1.y * v2.y);

		let cosTheta = dotProduct / (v1.magnitude() * v2.magnitude());
		cosTheta = Math.max(-1, Math.min(cosTheta, 1)); // Clamp to range of cos(x) [-1, 1]

		// Angle in radians
		const theta = Math.acos(cosTheta);

		// Convert to degrees
		return theta * (180 / Math.PI);
	}

	clone() {
		return new Vector(this.x, this.y);
	}

	zero() {
		this.x = 0;
		this.y = 0;
	}

	add(vector) {
		this.x += vector.x;
		this.y += vector.y;
	}

	subtract(vector) {
		this.x -= vector.x;
		this.y -= vector.y;
	}

	multiply(scalar) {
		this.x *= scalar;
		this.y *= scalar;
	}

	divide(scalar) {
		this.x /= scalar;
		this.y /= scalar;
	}

	magnitude() {
		return Math.sqrt(this.x * this.x + this.y * this.y);
	}

	/** Make this vector a unit vector of length 1 */
	normalize() {
		const m = this.magnitude();
		if (m !== 0) {
			this.divide(m);
		}
	}

	/** Restrict magnitude of this vector to at most `max` (upper limit) */
	upperLimit(max) {
		if (this.magnitude() > max) {
			this.normalize();
			this.multiply(max); // set length to max
		}
	}

	/** Restrict magnitude of this vector to at least `min` (lower limit) */
	lowerLimit(min) {
		if (this.magnitude() < min) {
			this.normalize();
			this.multiply(min); // set length to min
		}
	}
}