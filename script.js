import Utils from '/standup/Utils.js';

const availableNames = Utils.names;
const element = document.querySelector('.canvas');
const width = element.clientWidth;
const height = element.clientHeight;
const boardColor = '#707b88';
const numSlots = availableNames.length;

// sound setup
const bounceAudio = new Audio('186993__lloydevans09__wood-spin.wav');
function playBounceSound() {
    const clone = bounceAudio.cloneNode();
    clone.volume = 0.2;
    clone.play();
}

const dingAudio = new Audio('127149__daphne-in-wonderland__ding.wav');
function playDingSound() {
    dingAudio.cloneNode().play();
}

// module aliases
const {
    Engine,
    Events,
    Render,
    World,
    Bodies,
    Body,
    Mouse,
    MouseConstraint,
    Vertices
} = Matter;

const engine = Engine.create();
const render = Render.create({
    element,
    engine,
    options: {
        width,
        height,
        wireframes: false,
        background: '#272c35'
    }
});

// bodies
const s = document.body.clientHeight * 0.055; // base scale of the rendering
const leftOffset = document.body.clientWidth / 2 - s * ((numSlots - 2) / 2);
const topOffset = 2 * s;
const pegs = [];
for (let row = 0; row < 13; row++) {
    const cols = row % 2 ? numSlots-2 : numSlots-1;
    const offset = row % 2 ? s / 2 : 0
    const y = topOffset + s * row;
    for (let col = 0; col < cols; col++) {
        const x = leftOffset + s * col + offset;
        const peg = Bodies.circle(x, y, s / 15, {
            isStatic: true,
            render: {
                fillStyle: boardColor
            }
        });
        peg.__isPeg = true;
        pegs.push(peg);
    }
}

const leftSidePoints = [
    0, 0,
    s / 2, 0,
    s, s,
    s / 2, 2 * s,
    0, 2 * s,
];
const leftSides = []
const rightSides = [];
for (let i = 0; i < 6; i++) {
    // left sides
    leftSides.push(Bodies.fromVertices(document.body.clientWidth / 2 - s * (numSlots / 2) - s/4, s + 2 * s * (i + 1), Vertices.fromPath(leftSidePoints.join(' ')), {
        render: {
            fillStyle: boardColor
        }
    }));

    // right sides
    rightSides.push(Bodies.fromVertices(document.body.clientWidth / 2 + s * (numSlots / 2) + s/4, s + 2 * s * (i + 1), Vertices.fromPath(leftSidePoints.join(' ')), {
        render: {
            fillStyle: boardColor
        }
    }));
}

const leftSide = Body.create({
    parts: leftSides,
    isStatic: true
});
const rightSide = Body.create({
    parts: rightSides,
    isStatic: true
});
Body.rotate(rightSide, Math.PI);

const bottom = [
    Bodies.rectangle(document.body.clientWidth / 2, 16.2 * s, numSlots * s + s*1.28, 2.5 * s, { // bottom
        isStatic: true,
        render: {
            fillStyle: boardColor
        }
    }),
    Bodies.rectangle(document.body.clientWidth / 2 - s * (numSlots / 2) - s/2.56, 14.5 * s, s / 2, s, { // bottom left
        isStatic: true,
        render: {
            fillStyle: boardColor
        }
    }),
    Bodies.rectangle(document.body.clientWidth / 2 + s * (numSlots / 2) + s/2.56, 14.5 * s, s / 2, s, { // bottom right
        isStatic: true,
        render: {
            fillStyle: boardColor
        }
    })
];
for (let i = 0; i < numSlots-1; i++) { // bottom separators
    bottom.push(Bodies.rectangle(leftOffset + s * i, 14.8 * s, s / 15, s / 2, {
        isStatic: true,
        render: {
            fillStyle: boardColor
        }
    }));
}

const sensors = [];
for (let i = 0; i < numSlots; i++) {
    const sensor = Bodies.rectangle(leftOffset - s / 2 + s * i, 14.6 * s, s * .8, s * .7, {
        isSensor: true,
        isStatic: true,
        render: {
            fillStyle: 'orange',
            opacity: 0.0
        }
    });
    sensor.__data__ = i;
    sensors.push(sensor);
}

const walls = [
    Bodies.rectangle(width / 2, -1, width, 1, { // top
        isStatic: true
    }),
    Bodies.rectangle(-1, height / 2, 1, height, { // left
        isStatic: true
    }),
    Bodies.rectangle(width + 1, height / 2, 1, height, { // right
        isStatic: true
    }),
    Bodies.rectangle(width / 2, height + 1, width, 1, { // bottom
        isStatic: true
    })
];
const disc = Bodies.circle(document.body.clientWidth / 2 - numSlots/2 - s*9.55, s * 1.64, s * .357, {
    restitution: 0.9,
    render: {
        fillStyle: '#1497FF'
    }
});

// mouse interaction
const mouse = Mouse.create(render.canvas);
const mouseConstraint = MouseConstraint.create(engine, {
    mouse,
    constraint: {
        stiffness: 1,
        render: {
            visible: false
        }
    }
});
render.mouse = mouse;

// dim target: rgb(112,123,136)
const rgbTarget = [112, 123, 136];
const rgbReduceSteps = 24;
const rgbReduce = rgbTarget.map(rgb => rgb / rgbReduceSteps);
const dimStartId = '__dimStart';
function dim(body, dimStart, rgb) {
    if (body[dimStartId] !== dimStart || rgb.every((val, i) => val === rgbTarget[i])) {
        return;
    }
    // reduce colors by a constant amount
    const rgbNew = rgb.map((val, i) => Math.max(rgbTarget[i], val-rgbReduce[i]));
    window.requestAnimationFrame(() => {
        body.render.fillStyle = `rgb(${rgbNew.join(',')})`;
        dim(body, dimStart, rgbNew);
    });
}
function flash(body) {
    body[dimStartId] = +new Date();
    body.render.fillStyle = '#fff8c7';
    dim(body, body[dimStartId], [255, 248, 199]);
}

// sensor events
let prevSoundTs = 0;
const soundEffectThreshold = 10; // millis
Events.on(engine, 'collisionStart', function(event) {
    var pairs = event.pairs;
    for (var i = 0, j = pairs.length; i != j; ++i) {
        var pair = pairs[i];

        // play sound if hitting a peg
        if (pair.bodyA.__isPeg || pair.bodyB.__isPeg) {
            let ts = +new Date();
            if (ts - prevSoundTs > soundEffectThreshold) {
                playBounceSound();
                prevSoundTs = ts;
            }

            let peg = pair.bodyA.__isPeg ? pair.bodyA : pair.bodyB;
            flash(peg);
        }

        // detect the winner if chip collides with a sensor
        if (pair.bodyA.isSensor) {
            pickWinner(pair.bodyA.__data__);
            playDingSound();
        } else if (pair.bodyB.isSensor) {
            pickWinner(pair.bodyB.__data__);
            playDingSound();
        }
    }
});

Events.on(engine, 'collisionEnd', function(event) {
    var pairs = event.pairs;
    for (var i = 0, j = pairs.length; i != j; ++i) {
        var pair = pairs[i];

        // clear the winner if chip exits a sensor
        if (pair.bodyA.isSensor) {
            clearWinner(pair.bodyA.__data__);
        } else if (pair.bodyB.isSensor) {
            clearWinner(pair.bodyB.__data__);
        }
    }
});

World.add(engine.world, [...pegs, leftSide, rightSide, ...bottom, ...sensors, disc, ...walls, mouseConstraint]);
Engine.run(engine);
Render.run(render);

// names as HTML since Matter can't render text
const names = availableNames.slice(0, numSlots).map((n, i) => {
    const div = document.createElement('div');
    div.classList.add('name');
    div.style.position = 'absolute';
    div.style.left = leftOffset - s * 1.525 + s * i + 'px';
    div.style.top = 15.8 * s + 'px';
    div.style.height = s * .325 + 'px';
    div.style.width = 1.6 * s + 'px';
    div.style.fontSize = s / 3 + 'px';
    div.style.padding = s / 4.5 + 'px';
    div.innerHTML = n.value;
    div.setAttribute('data-pronounce', n.spoken || n.value);
    document.body.append(div);
    return div;
});

function clearWinner(i) {
    names[i].classList.remove('winner');
}

function pickWinner(i) {
    names[i].classList.add('winner');
}
