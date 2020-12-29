import DLA from '../../core/DLA'

const sketch = function (p5) {
    const dla = new DLA(p5, {p: 0.6})

    // Setup ---------------------------------------------------------------
    p5.setup = function () {
        p5.createCanvas(window.innerWidth, window.innerHeight)
        p5.colorMode(p5.HSB, 255)
        p5.ellipseMode(p5.CENTER)

        dla.settings.BiasTowards = 'Meridian'

        reset()
    }

    p5.draw = function () {
        dla.iterate()
        dla.draw()
    }

    function reset() {
        dla.removeAll()
        dla.createDefaultWalkers()
        dla.createDefaultClusters()
    }


    p5.keyReleased = function () {
        if (p5.key === 'r')
            reset()
        else if (p5.key === 'e')
            dla.export()

    }
}

new p5(sketch)
