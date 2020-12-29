/** @module DLA */

import Defaults from './Defaults'
import Collisions from 'collisions'

export default class DLA {
  constructor(p5, settings) {
    this.p5 = p5
    this.settings = {...Defaults, ...settings}
    this.p = settings.p
    this.numWalkers = 0
    this.edges = {}
    this.resetEdges()
    this.collisions = new Collisions()
    this.bodies = []
  }

  iterate() {
    this.moveWalkers()
    this.collisions.update()
    this.handleCollisions()
  }

  draw() {
    if (this.settings.UseColors)
      this.p5.background(DLA.getColorStringFromObject(this.settings.BackgroundColor))
    else
      this.p5.background(255)

    // Draw all walkers and clustered particles
    for (let body of this.bodies) {
      // Points
      if (body._point) {
        this.p5.noFill()

        if (body.stuck) {
          this.p5.noStroke()

          if (this.settings.UseColors) {
            this.p5.fill(this.getColorStringFromObject(this.settings.ClusterColor))
          } else {
            this.p5.fill(200)
          }

          this.p5.ellipse(body.x, body.y, 5)

        } else if (!body.stuck) {
          if (this.settings.UseColors) {
            this.p5.stroke(this.getColorStringFromObject(this.settings.WalkerColor))
          } else {
            this.p5.stroke(0)
          }
        } else {
          this.p5.noStroke()
        }

        this.p5.point(body.x, body.y)

        // Circles
      } else if (body._circle) {
        if (this.settings.UseStroke) {
          if (this.settings.UseColors) {
            this.p5.stroke(this.getColorStringFromObject(this.settings.BackgroundColor))
          } else {
            this.p5.stroke(255)
          }
        } else {
          this.p5.noStroke()
        }

        if (body.stuck) {
          if (this.settings.UseColors) {
            this.p5.fill(this.getColorStringFromObject(this.settings.ClusterColor))
          } else {
            this.p5.fill(120)
          }
        } else if (!body.stuck) {
          if (this.settings.UseColors) {
            this.p5.fill(this.getColorStringFromObject(this.settings.WalkerColor))
          } else {
            this.p5.fill(230)
          }
        } else {
          this.p5.noFill()
        }

        this.p5.ellipse(body.x, body.y, body.radius * 2)

        // Polygons
      } else if (body._polygon) {
        if (this.settings.UseStroke) {
          if (this.settings.UseColors) {
            this.p5.stroke(this.getColorStringFromObject(this.settings.BackgroundColor))
          } else {
            this.p5.stroke(255)
          }
        } else {
          this.p5.noStroke()
        }

        if (body.stuck) {
          if (this.settings.UseColors) {
            this.p5.fill(this.getColorStringFromObject(this.settings.ClusterColor))
          } else {
            this.p5.fill(120)
          }
        } else if (!body.stuck) {
          if (this.settings.UseColors) {
            this.p5.fill(this.getColorStringFromObject(this.settings.WalkerColor))
          } else {
            this.p5.fill(230)
          }
        } else {
          this.p5.noFill()
        }

        this.p5.beginShape()

        for (let i = 0; i < body._coords.length - 1; i += 2) {
          this.p5.vertex(body._coords[i], body._coords[i + 1])
        }

        this.p5.endShape()
      }
    }
  }

  resetEdges() {
    this.edges.left = 0
    this.edges.right = window.innerWidth
    this.edges.top = 0
    this.edges.bottom = window.innerHeight
  }

  moveWalkers() {
    if (this.bodies.length > 0) {
      for (let body of this.bodies) {
        if (!body.stuck) {
          let deltaX = this.p5.random(-1, 1)
          let deltaY = this.p5.random(-1, 1)

          if (body.x < window.innerWidth / 2)
            deltaX += this.settings.BiasForce
          else
            deltaX -= this.settings.BiasForce

          if (body._point) {
            deltaX = Math.round(deltaX)
            deltaY = Math.round(deltaY)
          }

          body.x += deltaX
          body.y += deltaY
        }
      }
    }
  }

  handleCollisions() {
    for (let body of this.bodies) {
      if (!body.stuck) {
        const potentials = body.potentials()

        for (let secondBody of potentials) {
          if (body._point) {
            if (secondBody.stuck) {
              body.stuck = Math.random() <= this.p
              this.numWalkers--
            }

          } else {
            if (secondBody.stuck && body.collides(secondBody)) {
              body.stuck = Math.random() <= this.p
              this.numWalkers--
            }
          }
        }
      }
    }
  }

  createParticle(params) {
    if (!params || typeof params != 'object')
      return

    let body

    if (params.hasOwnProperty('type')) {
      body = this.collisions.createPoint(Math.round(params.x), Math.round(params.y))
      body._point = true
    } else {
      const diameter = params.hasOwnProperty('diameter') ? params.diameter : this.settings.CircleDiameter
      body = this.collisions.createCircle(params.x, params.y, diameter / 2)
      body._circle = true
    }

    body.stuck = !!params.stuck

    if (params.hasOwnProperty('BiasTowards')) {
      body.BiasTowards = params.BiasTowards
    }

    body.originalX = body.x
    body.originalY = body.y

    this.bodies.push(body)
  }

  createWalker(params) {
    this.createParticle(params)
    this.numWalkers++
  }

  createDefaultWalkers(count = this.settings.MaxWalkers, source = this.settings.WalkerSource) {
    for (let i = 0; i < count; i++) {
      let params = {}

      params.x = this.p5.random(this.edges.left, this.edges.right)
      params.y = this.p5.random(this.edges.top, this.edges.bottom)

      this.createWalker(params)
    }
  }

  createDefaultClusters() {
    this.createClusterFromParams(this.createVerticalClusterWall(window.innerWidth / 2))
  }

  createVerticalClusterWall(xPos) {
    let coords = [],
      height = window.innerHeight

    for (let i = 0; i <= height / this.settings.CircleDiameter; i++) {
      coords.push({
        x: xPos,
        y: this.edges.top + i * this.settings.CircleDiameter,
        diameter: this.settings.CircleDiameter
      })
    }

    return coords
  }

  createClusterFromParams(paramsList) {
    if (paramsList.length > 0) {
      for (let params of paramsList) {
        params.stuck = true
        this.createParticle(params)
      }
    }
  }

  removeAll() {
    for (let body of this.bodies)
      this.collisions.remove(body)

    this.bodies = []
    this.numWalkers = 0
  }

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
