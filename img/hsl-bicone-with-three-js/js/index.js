'use strict';

var WHITE = new THREE.Color('white'),
    BLACK = new THREE.Color('black'),
    GREY_50 = new THREE.Color('#7f7f7f'),
    C_MAP = [],
    SLICES = [],
    DATA = {
	num_slices: 36,
	cone_radius: 170,
	cone_height: 150,
	axis_radius: 2,
	texture_dim: 128,
	f_arc: .75
},
    CAMERA = new (Function.prototype.bind.apply(THREE.PerspectiveCamera, [null].concat([70 /* camera frustum vertical field of view */
, window.innerWidth / window.innerHeight /* camera frustum aspect ratio */
, 1 /* camera frustum near plane */
, 1000 /* camera frustum far plane */])))(),
    SCENE = new THREE.Scene(),
    RENDERER = new THREE.WebGLRenderer({ antialias: true }),
    A3D = new THREE.Group();

var drag = false,
    x0 = null,
    rID = null;

function onWindowResize() {
	CAMERA.aspect = window.innerWidth / window.innerHeight;
	CAMERA.updateProjectionMatrix();
	RENDERER.setSize(window.innerWidth, window.innerHeight);
};

function createCMap() {
	var DEG_ANG = 360 / DATA.num_slices;

	for (var i = 0; i < DATA.num_slices; i++) {
		C_MAP.push(new THREE.Color('hsl(' + i * DEG_ANG + ', 100%, 50%)'));
	}
};

function getLinearGradTexture(line, c_arr) {
	var _CANVAS = document.createElement('canvas'),
	    CTX = _CANVAS.getContext('2d'),
	    GRAD = CTX.createLinearGradient.apply(CTX, line),
	    N = c_arr.length,
	    STEP = 1 / (N - 1);

	_CANVAS.width = _CANVAS.height = DATA.texture_dim;

	for (var i = 0; i < N; i++) {
		GRAD.addColorStop(i * STEP, '#' + c_arr[i].getHexString());
	}

	CTX.fillStyle = GRAD;
	CTX.fillRect(0, 0, _CANVAS.width, _CANVAS.height);

	return new THREE.CanvasTexture(_CANVAS);
};

function getAxisLine(len, texture) {
	var geometry = new (Function.prototype.bind.apply(THREE.CylinderGeometry, [null].concat([DATA.axis_radius /* radius top */
	, DATA.axis_radius /* radius bottom */
	, len /* height */
	, 12 /* radius segments */
	])))(),
	    material = new THREE.MeshBasicMaterial({ map: texture });

	return new THREE.Mesh(geometry, material);
};

function getAxisArrow(c) {
	var geometry = new (Function.prototype.bind.apply(THREE.ConeGeometry, [null].concat([2 * DATA.axis_radius /* radius */
	, 7 * DATA.axis_radius /* height */
	, 12 /* radius segments */])))(),
	    material = new THREE.MeshBasicMaterial({ color: c });

	return new THREE.Mesh(geometry, material);
};

function getLightnessAxis() {
	var line_mesh = getAxisLine.apply(undefined, [DATA.axis_height, getLinearGradTexture.apply(undefined, [[0, 0, 0, DATA.texture_dim], [WHITE, BLACK]])]),
	    arrw_mesh = getAxisArrow(WHITE),
	    l_axis = new THREE.Group();

	arrw_mesh.position.y = .5 * DATA.axis_height;
	l_axis.add(line_mesh);
	l_axis.add(arrw_mesh);
	return l_axis;
};

function getSaturationAxis(c) {
	var line_mesh = getAxisLine.apply(undefined, [DATA.cone_radius, getLinearGradTexture.apply(undefined, [[0, 0, 0, DATA.texture_dim], [c, GREY_50]])]),
	    arrw_mesh = getAxisArrow(c),
	    s_axis = new THREE.Group();

	arrw_mesh.position.y = .5 * DATA.cone_radius;

	s_axis.add(line_mesh);
	s_axis.add(arrw_mesh);

	return s_axis;
};

function getHueAxis() {
	var end = Math.round(DATA.f_arc * DATA.num_slices),
	    circ_mesh = new (Function.prototype.bind.apply(THREE.Mesh, [null].concat([new (Function.prototype.bind.apply(THREE.TorusGeometry, [null].concat([DATA.huet_radius, DATA.axis_radius, 16, 100, DATA.f_arc * 2 * Math.PI])))(), new THREE.MeshBasicMaterial({
		map: getLinearGradTexture.apply(undefined, [[0, 0, DATA.texture_dim, 0], C_MAP.slice(0, end + 1)]),
		side: THREE.DoubleSide
	})])))(),
	    arrw_mesh = getAxisArrow(C_MAP[end]),
	    h_axis = new THREE.Group();

	circ_mesh.rotation.x = -.5 * Math.PI;
	arrw_mesh.position.z = DATA.huet_radius;
	arrw_mesh.rotation.z = -.5 * Math.PI;
	h_axis.rotation.y = -.5 * (Math.PI + DATA.base_ang);

	h_axis.add(circ_mesh);
	h_axis.add(arrw_mesh);

	return h_axis;
};

function createSlices() {
	var C_ARR = [],
	    GREY50 = new THREE.Color('hsl(0, 100%, 50%)');

	var geometry = undefined,
	    material = undefined,
	    mesh = undefined,
	    sign = undefined,
	    points = undefined,
	    vy = undefined,
	    slice_obj = undefined,
	    sat_axis = undefined,
	    start_ang = undefined,
	    c_tip = undefined,
	    c_edge = undefined;

	for (var i = 0; i < DATA.num_slices; i++) {
		slice_obj = {
			angle: i * DATA.base_ang /* slice angle */
			, group: new THREE.Group(),
			c0: C_MAP[i],
			c1: C_MAP[(i + 1) % DATA.num_slices],
			halves: []
		};
		start_ang = (i - 1.5) * DATA.base_ang;

		sat_axis = getSaturationAxis(slice_obj.c0);
		sat_axis.position.x = .5 * DATA.cone_inrad * Math.sin(slice_obj.angle);
		sat_axis.position.z = .5 * DATA.cone_inrad * Math.cos(slice_obj.angle);
		sat_axis.rotation.x = .5 * Math.PI;
		sat_axis.rotation.z = -slice_obj.angle;
		slice_obj.group.add(sat_axis);

		for (var j = 0; j < 2; j++) {
			sign = Math.pow(-1, j);
			c_tip = j ? BLACK : WHITE;
			c_edge = j ? WHITE : BLACK;
			points = [];

			geometry = new (Function.prototype.bind.apply(THREE.ConeGeometry, [null].concat([DATA.cone_radius /* radius */
			, sign * DATA.cone_height /* height */
			, 3 /* radius segments */
			, 1 /* height segments */
			, false /* open ended */
			, start_ang /* start angle for first segment */
			, 3 * DATA.base_ang /* central angle of this slice */
			])))();

			/* Vertices: 
    * 0 - cone vertex
    * 1 - 1st radius segment start point; move to 5
    * 2 - 1st radius segment end/ 2nd radius segment start point
    * 3 - 2nd radius segment end/ 3rd radius segment start point
    * 4 - 3rd radius segment end point; move to 5
    * 5 - cone base mid 
    * 
    * Faces:
    * 0 - vertices 1 2 0 (lateral start) 
    * 1 - vertices 2 3 0 (outer) 
    * 2 - vertices 3 4 0 (lateral end) 
    * 3 - vertices 2 1 5 (base flattened start) -> discard
    * 4 - vertices 3 2 5 (base)
    * 3 - vertices 2 1 5 (base flattened start) -> discard
    */

			/* flap the 1st and 3rd radial segments 
    * onto the lateral faces of the slice
    * by moving vertices 1 and 4 in the same position as 5 */
			geometry.vertices[1].x = geometry.vertices[1].z = geometry.vertices[4].x = geometry.vertices[4].z = 0;
			vy = geometry.vertices[0].z;

			for (var k = 1; k < 5; k++) {
				var f = k / 5,
				    g = 1 - f;
				points.push([f * geometry.vertices[2].x + g * geometry.vertices[5].x, f * geometry.vertices[2].y + g * geometry.vertices[5].y, f * geometry.vertices[2].z + g * geometry.vertices[5].z]);
				points.push([f * geometry.vertices[3].x + g * geometry.vertices[5].x, f * geometry.vertices[3].y + g * geometry.vertices[5].y, f * geometry.vertices[3].z + g * geometry.vertices[5].z]);
				points.push([f * geometry.vertices[2].x + g * geometry.vertices[0].x, f * geometry.vertices[2].y + g * geometry.vertices[0].y, f * geometry.vertices[2].z + g * geometry.vertices[0].z]);
				points.push([f * geometry.vertices[3].x + g * geometry.vertices[0].x, f * geometry.vertices[3].y + g * geometry.vertices[0].y, f * geometry.vertices[3].z + g * geometry.vertices[0].z]);
				points.push([f * geometry.vertices[5].x + g * geometry.vertices[0].x, f * geometry.vertices[5].y + g * geometry.vertices[0].y, f * geometry.vertices[5].z + g * geometry.vertices[0].z]);
			}

			/* create mesh gradients */
			geometry.faces[0].vertexColors = [GREY_50, slice_obj.c0, c_tip];
			geometry.faces[1].vertexColors = [slice_obj.c0, slice_obj.c1, c_tip];
			geometry.faces[2].vertexColors = [slice_obj.c1, GREY_50, c_tip];
			geometry.faces[4].vertexColors = [slice_obj.c1, slice_obj.c0, GREY_50];

			material = new THREE.MeshBasicMaterial({
				vertexColors: THREE.VertexColors
			});
			if (j) material.side = THREE.BackSide;

			mesh = new THREE.Mesh(geometry, material);

			mesh.position.y = Math.pow(-1, j) * .5 * DATA.cone_height;

			/* highlight the slice edges */
			var lgeometry = new THREE.EdgesGeometry(mesh.geometry);
			material = new THREE.LineBasicMaterial({ color: c_edge });
			mesh.add(new THREE.LineSegments(geometry, material));

			for (var k = 0; k < 5; k++) {
				lgeometry = new THREE.Geometry();
				lgeometry.vertices.push(new (Function.prototype.bind.apply(THREE.Vector3, [null].concat(points[k * 5 + 0])))(), new (Function.prototype.bind.apply(THREE.Vector3, [null].concat(points[k * 5 + 1])))(), geometry.vertices[0]);
				mesh.add(new THREE.LineLoop(lgeometry, material));

				lgeometry = new THREE.Geometry();
				lgeometry.vertices.push(new (Function.prototype.bind.apply(THREE.Vector3, [null].concat(points[k * 5 + 2])))(), new (Function.prototype.bind.apply(THREE.Vector3, [null].concat(points[k * 5 + 3])))(), new (Function.prototype.bind.apply(THREE.Vector3, [null].concat(points[k * 5 + 4])))());
				mesh.add(new THREE.LineLoop(lgeometry, material));
			}

			slice_obj.halves[j] = mesh;
			/* add this half slice to the slice group */
			slice_obj.group.add(mesh);
		}

		slice_obj.maxx = DATA.exp_h * Math.sin(slice_obj.angle);
		slice_obj.maxz = DATA.exp_h * Math.cos(slice_obj.angle);
		SLICES.push(slice_obj);
		A3D.add(slice_obj.group);
	}
};

function getE(ev) {
	return ev.touches ? ev.touches[0] : ev;
};

function lock(ev) {
	var e = getE(ev);
	drag = true;
	x0 = e.clientX;
};

function rotate(ev) {
	if (drag) {
		var e = getE(ev),
		    x = e.clientX,
		    dx = x - x0;

		A3D.rotation.y += .002 * dx;
		RENDERER.render(SCENE, CAMERA);

		x0 = x;
	}
};

function release(ev) {
	if (drag) {
		drag = false;
		x0 = null;
	}
};

function animate() {
	A3D.rotation.y += 0.01;
	RENDERER.render(SCENE, CAMERA);
	requestAnimationFrame(animate);
};

function explode(sign) {
	var exit = false;

	for (var i = 0; i < DATA.num_slices; i++) {
		var slice_obj = SLICES[i],
		    test = 1 * (sign === 1),
		    endx = test * slice_obj.maxx,
		    endz = test * slice_obj.maxz,
		    dx = undefined,
		    dz = undefined;

		slice_obj.group.position.x += sign * .02 * slice_obj.maxx;
		slice_obj.group.position.z += sign * .02 * slice_obj.maxz;

		dx = Math.abs(slice_obj.group.position.x - endx);
		dz = Math.abs(slice_obj.group.position.z - endz);

		for (var j = 0; j < 2; j++) {
			var mesh = slice_obj.halves[j];

			mesh.position.y += sign * Math.pow(-1, j) * .02 * DATA.exp_h;
		}

		if (dx < .1 && dz < .1 || exit) {
			slice_obj.group.position.x = endx;
			slice_obj.group.position.z = endz;
			exit = exit || true;

			for (var j = 0; j < 2; j++) {
				var mesh = slice_obj.halves[j];

				mesh.position.y = Math.pow(-1, j) * (.5 * DATA.cone_height + test * DATA.exp_h);
			}
		}
	}

	RENDERER.render(SCENE, CAMERA);

	if (exit) {
		cancelAnimationFrame(rID);
		rID = null;
		return;
	}

	rID = requestAnimationFrame(explode.bind(this, sign));
};

(function init() {
	DATA.base_ang = 2 * Math.PI / DATA.num_slices;
	DATA.cone_inrad = DATA.cone_radius * Math.cos(.5 * DATA.base_ang);
	DATA.axis_height = 3.25 * DATA.cone_height;
	DATA.exp_h = .3 * DATA.cone_radius;
	DATA.exp_v = .3 * DATA.cone_height;
	DATA.huet_radius = DATA.cone_radius + DATA.exp_h + 4 * DATA.axis_radius;

	createCMap();

	A3D.add(getLightnessAxis());
	A3D.add(getHueAxis());
	createSlices();

	SCENE.add(A3D);
	A3D.rotation.x = .13;

	CAMERA.position.z = 400;
	RENDERER.setPixelRatio(window.devicePixelRatio);
	RENDERER.setSize(window.innerWidth, window.innerHeight);
	RENDERER.setClearColor(0xccaaaa);
	RENDERER.render(SCENE, CAMERA);

	document.body.appendChild(RENDERER.domElement);

	window.addEventListener('resize', onWindowResize, false);

	document.addEventListener('mousedown', lock, false);
	document.addEventListener('touchstart', lock, false);

	document.addEventListener('mousemove', rotate, false);
	document.addEventListener('touchmove', rotate, false);

	document.addEventListener('mouseup', release, false);
	document.addEventListener('touchend', release, false);

	document.getElementById('explode').addEventListener('change', function (e) {
		if (rID) {
			cancelAnimationFrame(rID);
			rID = null;
		}

		explode(Math.pow(-1, e.target.checked + 1));
	}, false);
})();