/** @module DLA */

import Defaults from './Defaults';
import Collisions from 'collisions';

export default class DLA {
    constructor(p5, settings) {
        this.p5 = p5;
        this.settings = {...Defaults, ...settings}
        this.p = settings.p;
        // State flags
        this.renderMode = this.settings.RenderMode;

        this.numWalkers = 0;

        this.customMovementFunction = undefined;

        this.edgeMargin = this.settings.EdgeMargin;
        this.edges = {};

        this.resetEdges();

        // Precalculate the largest possible distance of any particle to center for use in distance-based effects later
        this.maxDistance = this.p5.dist(this.edges.left, this.edges.top, window.innerWidth / 2, window.innerHeight / 2);

        // Collision system
        this.system = new Collisions();
        this.bodies = [];
        this.shapes = [];
        this.lines = [];
    }

    /** Run one "tick" of the simulation */
    iterate() {
        // Replenish any walkers that stuck to the cluster(s) in the last iteration
        if (this.settings.ReplenishWalkers && this.numWalkers < this.settings.MaxWalkers) {
            this.createDefaultWalkers(this.settings.MaxWalkers - this.numWalkers, this.settings.ReplenishmentSource);
        }

        // Move all the walkers
        this.moveWalkers();

        // Update the collision system
        this.system.update();

        // Check for collisions and convert walkers to cluster particles as needed
        this.handleCollisions();

        // Remove any walkers that have been walking around for too long
        this.pruneWalkers();
    }


    /** Draw all objects based on current visibility flags and colors */
    draw() {
        if (this.settings.UseColors) {
            this.p5.background(DLA.getColorStringFromObject(this.settings.BackgroundColor));
        } else {
            this.p5.background(255);
        }


        for (const shape of this.shapes) {
            this.p5.noFill();
            this.p5.stroke(100);

            this.p5.beginShape();

            for (let i = 0; i < shape._coords.length; i += 2)
                this.p5.vertex(shape._coords[i], shape._coords[i + 1]);

            this.p5.endShape();
        }


        // Draw all walkers and clustered particles
        if (this.renderMode === 'Lines') {
            if (this.settings.UseColors) {
                this.p5.stroke(this.getColorStringFromObject(this.settings.LineColor));
            } else {
                this.p5.stroke(75);
            }

            if (this.lines.length > 0) {
                for (let line of this.lines) {
                    this.p5.line(line.p1.x, line.p1.y, line.p2.x, line.p2.y);
                }
            }
        } else {
            for (let body of this.bodies) {
                // Points
                if (body._point) {
                    this.p5.noFill();

                    if (body.stuck) {
                        this.p5.noStroke();

                        if (this.settings.UseColors) {
                            this.p5.fill(this.getColorStringFromObject(this.settings.ClusterColor));
                        } else {
                            this.p5.fill(200);
                        }

                        this.p5.ellipse(body.x, body.y, 5);

                    } else if (!body.stuck) {
                        if (this.settings.UseColors) {
                            this.p5.stroke(this.getColorStringFromObject(this.settings.WalkerColor));
                        } else {
                            this.p5.stroke(0)
                        }
                    } else {
                        this.p5.noStroke();
                    }

                    this.p5.point(body.x, body.y);

                    // Circles
                } else if (body._circle) {
                    if (this.settings.UseStroke) {
                        if (this.settings.UseColors) {
                            this.p5.stroke(this.getColorStringFromObject(this.settings.BackgroundColor));
                        } else {
                            this.p5.stroke(255);
                        }
                    } else {
                        this.p5.noStroke();
                    }

                    if (body.stuck) {
                        if (this.settings.UseColors) {
                            this.p5.fill(this.getColorStringFromObject(this.settings.ClusterColor));
                        } else {
                            this.p5.fill(120);
                        }
                    } else if (!body.stuck) {
                        if (this.settings.UseColors) {
                            this.p5.fill(this.getColorStringFromObject(this.settings.WalkerColor));
                        } else {
                            this.p5.fill(230);
                        }
                    } else {
                        this.p5.noFill();
                    }

                    this.p5.ellipse(body.x, body.y, body.radius * 2);

                    // Polygons
                } else if (body._polygon) {
                    if (this.settings.UseStroke) {
                        if (this.settings.UseColors) {
                            this.p5.stroke(this.getColorStringFromObject(this.settings.BackgroundColor));
                        } else {
                            this.p5.stroke(255);
                        }
                    } else {
                        this.p5.noStroke();
                    }

                    if (body.stuck) {
                        if (this.settings.UseColors) {
                            this.p5.fill(this.getColorStringFromObject(this.settings.ClusterColor));
                        } else {
                            this.p5.fill(120);
                        }
                    } else if (!body.stuck) {
                        if (this.settings.UseColors) {
                            this.p5.fill(this.getColorStringFromObject(this.settings.WalkerColor));
                        } else {
                            this.p5.fill(230);
                        }
                    } else {
                        this.p5.noFill();
                    }

                    this.p5.beginShape();

                    for (let i = 0; i < body._coords.length - 1; i += 2) {
                        this.p5.vertex(body._coords[i], body._coords[i + 1]);
                    }

                    this.p5.endShape();
                }
            }
        }
    }


    /** Recalculate the positions of the four edges of the simulation based on whether the frame is in use or not. */
    resetEdges() {
        this.edges.left = 0;
        this.edges.right = window.innerWidth;
        this.edges.top = 0;
        this.edges.bottom = window.innerHeight;
    }


    /** Apply Brownian motion and bias forces to all walkers to make them move a little bit. */
    moveWalkers() {
        if (this.bodies.length > 0) {
            for (let body of this.bodies) {
                if (!body.stuck) {
                    // Start with a randomized movement (Brownian motion)
                    let deltaX = this.p5.random(-1, 1),
                        deltaY = this.p5.random(-1, 1),
                        deltas;

                    // Add in per-walker bias, if enabled
                    if (this.settings.UsePerWalkerBias && body.hasOwnProperty('BiasTowards')) {
                        deltas = this.getDeltasTowards(body.x, body.y, body.BiasTowards.x, body.BiasTowards.y);
                        deltaX += deltas.x;
                        deltaY += deltas.y;

                        // Otherwise add in uniform bias to all walkers (if defined)
                    } else {

                        // Add in a bias towards a specific direction, if set
                        switch (this.settings.BiasTowards) {
                            case 'Equator':
                                if (body.y < window.innerHeight / 2) {
                                    deltaY += this.settings.BiasForce;
                                } else {
                                    deltaY -= this.settings.BiasForce;
                                }

                                break;

                            case 'Meridian':
                                if (body.x < window.innerWidth / 2) {
                                    deltaX += this.settings.BiasForce;
                                } else {
                                    deltaX -= this.settings.BiasForce;
                                }

                                break;
                        }
                    }

                    // Apply custom movement function, if it has been provided
                    if (this.customMovementFunction && this.customMovementFunction instanceof Function) {
                        let deltas = this.customMovementFunction(body);
                        deltaX += deltas.dx;
                        deltaY += deltas.dy;
                    }

                    // Ensure only whole numbers for single-pixel particles so they are always "on lattice"
                    if (body._point) {
                        deltaX = Math.round(deltaX);
                        deltaY = Math.round(deltaY);
                    }

                    // Apply deltas to walker
                    body.x += deltaX;
                    body.y += deltaY;

                    // Increment age of the walker
                    body.age++;
                }
            }
        }
    }

    /**
     * Calculates movement deltas for a given walker in order to move it towards a given point in space.
     * @param {number} bodyX - X coordinate of walker to move
     * @param {number} bodyY  - Y coordinate of walker to move
     * @param {number} targetX  - X coordinate of target we want to move the walker towards
     * @param {number} targetY  - YY coordinate of target we want to move the walker towards
     * @returns {Object} Object with properties x and y representing directional forces to apply to walker
     */
    getDeltasTowards(bodyX, bodyY, targetX, targetY) {
        let angle = Math.atan2(targetY - bodyY, targetX - bodyX);

        return {
            x: Math.cos(angle) * this.settings.BiasForce,
            y: Math.sin(angle) * this.settings.BiasForce
        }
    }

    /** Look for collisions between walkers and clustered elements, converting walkers to clustered particles as needed. */
    handleCollisions() {
        // Look for collisions between walkers and custom shapes
        for (let shape of this.shapes) {
            const potentials = shape.potentials();

            for (let secondBody of potentials) {
                if (shape.collides(secondBody)) {
                    secondBody.stuck = true;
                    this.numWalkers--;
                }
            }
        }

        // Look for collisions between walkers and clustered particles
        for (let body of this.bodies) {
            // Cut down on duplicate computations by only looking for collisions on walkers
            if (body.stuck) {
                continue;
            }

            // Look for broadphase collisions
            const potentials = body.potentials();

            for (let secondBody of potentials) {

                // Points should be checked for adjacency to a stuck particle
                if (body._point) {
                    if (secondBody.stuck) {
                        body.stuck = Math.random() <= this.p;
                        this.numWalkers--;
                    }

                    // Circles and polygons should be checked for collision (overlap) with potentials
                } else {
                    if (secondBody.stuck && body.collides(secondBody)) {
                        body.stuck = Math.random() <= this.p;
                        this.numWalkers--;

                        if (this.settings.CaptureLines) {
                            this.lines.push({
                                p1: {x: body.x, y: body.y},
                                p2: {x: secondBody.x, y: secondBody.y}
                            });
                        }
                    }
                }
            }
        }
    }

    /** Remove any walkers that are no longer "useful" in an effort to make the simulation more efficient. */
    pruneWalkers() {
        // Remove any walkers that have been wandering around for too long
        if (this.settings.PruneOldWalkers || this.settings.PruneDistantWalkers) {
            for (let [index, body] of this.bodies.entries()) {
                if (
                    !body.stuck &&
                    (
                        (this.settings.PruneOldWalkers && body.age > this.settings.MaxAge) ||
                        (this.settings.PruneDistantWalkers && this.p5.dist(body.x, body.y, body.originalX, body.originalY) > this.settings.MaxWanderDistance)
                    )
                ) {
                    body.remove();
                    this.bodies.splice(index, 1);
                    this.numWalkers--;
                }
            }
        }
    }


    /**
     * Creates a new body (walker or clustered particle) using the provided parameters in the collision system and stores it in a private array for manipulation later.
     * @param {object} params - Object of particle parameters such as X/Y coordinates, type, shape, and rotation
     */
    createParticle(params) {
        if (!params || typeof params != 'object')
            return;

        let body;

        if (params.hasOwnProperty('type')) {
            switch (params.type) {
                case 'Point':
                    body = this.system.createPoint(Math.round(params.x), Math.round(params.y));
                    body._point = true;
                    break;

                case 'Circle':
                default:
                    body = this.system.createCircle(params.x, params.y, params.diameter / 2);
                    body._circle = true;
                    break;

                case 'Polygon':
                    body = this.system.createPolygon(params.x, params.y, params.polygon, params.hasOwnProperty('rotation') ? this.p5.radians(params.rotation) : 0);
                    body._polygon = true;
                    break;
            }
        } else {
            const diameter = params.hasOwnProperty('diameter') ? params.diameter : this.settings.CircleDiameter;
            body = this.system.createCircle(params.x, params.y, diameter / 2);
            body._circle = true;
        }

        body.stuck = params.hasOwnProperty('stuck') ? params.stuck : false;
        body.age = 0;

        if (params.hasOwnProperty('BiasTowards')) {
            body.BiasTowards = params.BiasTowards;
        }

        body.originalX = body.x;
        body.originalY = body.y;

        this.bodies.push(body);
    }

    /**
     * Wrapper for createParticle() that increments internal count of walkers.
     * @param {Object} params - Object of particle parameters such as X/Y coordinates, type, shape, and rotation
     */
    createWalker(params) {
        this.createParticle(params);
        this.numWalkers++;
    }

    /**
     * Create a set of walkers in a specific area in the simulation (center, edges, randomly, etc).
     * @param {number} count - Number of walkers to create
     * @param {string} source - Location where walkers should be created.
     */
    createDefaultWalkers(count = this.settings.MaxWalkers, source = this.settings.WalkerSource) {
        for (let i = 0; i < count; i++) {
            let params = {};

            params.x = this.p5.random(this.edges.left, this.edges.right);
            params.y = this.p5.random(this.edges.top, this.edges.bottom);

            this.createWalker(params);
        }
    }

    /**
     * Create a set of clustered particles with the provided pattern.
     * @param {string} clusterType - Pattern to create all clustered particles with. Can be Point, Ring, Random, or Wall
     */
    createDefaultClusters(clusterType = this.settings.InitialClusterType) {
        let paramsList = [];
        switch (this.settings.BiasTowards) {
            case 'Equator':
                paramsList = paramsList.concat(this.createHorizontalClusterWall(window.innerHeight / 2));
                break;

            case 'Meridian':
                paramsList = paramsList.concat(this.createVerticalClusterWall(window.innerWidth / 2));
                break;
        }

        this.createClusterFromParams(paramsList);
    }

    /**
     * Create a horizontal line of clustered particles at a given Y coordinate
     * @param {number} yPos - vertical coordinate where line of particles is created
     * @returns {Object} Object containing X and Y coordinates of all clustered particles in line
     */
    createHorizontalClusterWall(yPos) {
        let coords = [],
            width = window.innerWidth;

        for (let i = 0; i <= width / this.settings.CircleDiameter; i++) {
            coords.push({
                x: this.edges.left + i * this.settings.CircleDiameter,
                y: yPos,
                diameter: this.settings.CircleDiameter
            });
        }

        return coords;
    }

    /**
     * Create a vertical line of clustered particles at a given X coordinate
     * @param {number} xPos - horizontal coordinate where line of particles is created
     * @return {Object} Object containing the X and Y coordinates of all clustered particles in line
     */
    createVerticalClusterWall(xPos) {
        let coords = [],
            height = window.innerHeight;

        for (let i = 0; i <= height / this.settings.CircleDiameter; i++) {
            coords.push({
                x: xPos,
                y: this.edges.top + i * this.settings.CircleDiameter,
                diameter: this.settings.CircleDiameter
            });
        }

        return coords;
    }

    /**
     * Create a set of clustered particles from an array of individual particle parameters
     * @param {Array} paramsList - Array of objects containing particle parameters.
     */
    createClusterFromParams(paramsList) {
        if (paramsList.length > 0) {
            for (let params of paramsList) {
                params.stuck = true;
                this.createParticle(params);
            }
        }
    }

    //==============
    //  Removers
    //==============
    /** Remove all walkers, clustered particles, shapes, and lines from the system */
    removeAll() {
        for (let body of this.bodies) {
            this.system.remove(body);
        }

        for (let shape of this.shapes) {
            this.system.remove(shape);
        }

        this.bodies = [];
        this.shapes = [];
        this.lines = [];
        this.numWalkers = 0;
    }


    //======================
    //  Utility functions
    //======================
    /**
     * Create an HSL-formatted string that plays well with p5.js from an object with appropriate properties
     * @param {object} colorObject - Object with the properties h, s, and b (all numbers)
     * @returns {string} - String in the format of hsl({h}, {s}, {b})
     */
    static getColorStringFromObject(colorObject) {
        return 'hsla(' +
            colorObject.h + ', ' +
            colorObject.s + '%, ' +
            colorObject.b + '%, ' +
            DLA.getOpacity(colorObject) +
            ')'
    }

    static getOpacity(colorObject) {
        return 'a' in colorObject ? colorObject.a : '1.0'
    }
}
