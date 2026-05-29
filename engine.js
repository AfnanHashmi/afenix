/* =========================================================
   AFENIX — living 3D engine
   1) Persistent neural field you scroll THROUGH (camera dolly)
   2) Force-directed graph you can grab & fling (real spring physics)
   3) Scroll narrative + reveals + magnetic UI
   ========================================================= */
(function () {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(pointer:fine)').matches;
  const C = { blue: 0x4aa6ff, blueBright: 0x7fd0ff, gold: 0xe8b667, goldBright: 0xf6d79b, sil: 0xbcd6ff };

  /* ---------- smooth scroll progress (eased) ---------- */
  let scrollY = window.scrollY, scrollEased = scrollY;
  addEventListener('scroll', () => { scrollY = window.scrollY; }, { passive: true });

  /* =========================================================
     1 · PERSISTENT 3D NEURAL FIELD  (background)
     The camera flies forward through a volumetric node cloud
     as you scroll — the world is always alive.
     ========================================================= */
  function neuralField() {
    const cv = document.getElementById('bg');
    if (!cv || !window.THREE) return;
    const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(innerWidth, innerHeight);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 6000);
    camera.position.set(0, 0, 60);

    const cB = new THREE.Color(C.blue), cG = new THREE.Color(C.gold), cS = new THREE.Color(C.sil);
    const starWhite = new THREE.Color(0xeaf2ff);

    // soft round glow sprite (shared by stars, pulses, nebula, galaxy)
    const sprite = (() => {
      const s = 64, c = document.createElement('canvas'); c.width = c.height = s;
      const g = c.getContext('2d');
      const rg = g.createRadialGradient(s/2, s/2, 0, s/2, s/2, s/2);
      rg.addColorStop(0, 'rgba(255,255,255,1)');
      rg.addColorStop(0.25, 'rgba(255,255,255,0.85)');
      rg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = rg; g.fillRect(0, 0, s, s);
      return new THREE.CanvasTexture(c);
    })();

    /* =========================================================
       TWINKLING STARFIELD — present the whole journey
       ========================================================= */
    const SF = innerWidth < 760 ? 1600 : 3000;
    const sfGeo = new THREE.BufferGeometry();
    const sfPos = new Float32Array(SF * 3), sfCol = new Float32Array(SF * 3);
    const sfPh = new Float32Array(SF), sfSp = new Float32Array(SF), sfBri = new Float32Array(SF);
    for (let i = 0; i < SF; i++) {
      sfPos[i*3]   = (Math.random() - 0.5) * 1200;
      sfPos[i*3+1] = (Math.random() - 0.5) * 800;
      sfPos[i*3+2] = -Math.random() * 1800 - 60;
      const hero = Math.random() < 0.06;
      sfBri[i] = hero ? (Math.random()*1.6+1.4) : (Math.random()*0.5+0.25);
      const r = Math.random();
      const c = r < 0.7 ? starWhite.clone()
              : r < 0.85 ? cB.clone().lerp(starWhite, 0.5)
              : cG.clone().lerp(starWhite, 0.5);
      sfCol[i*3]=c.r; sfCol[i*3+1]=c.g; sfCol[i*3+2]=c.b;
      sfPh[i] = Math.random()*Math.PI*2; sfSp[i] = Math.random()*2.4+0.4;
    }
    sfGeo.setAttribute('position', new THREE.BufferAttribute(sfPos, 3));
    sfGeo.setAttribute('color', new THREE.BufferAttribute(sfCol, 3));
    const sfBase = sfCol.slice();
    const SF_DEPTH = 1800;
    const starfield = new THREE.Points(sfGeo, new THREE.PointsMaterial({
      size: 2.4, map: sprite, vertexColors: true, transparent: true,
      opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true, fog: false
    }));
    starfield.renderOrder = -5;
    scene.add(starfield);

    /* =========================================================
       AMBIENT CONSTELLATIONS — the cosmos quietly draws itself
       Every few seconds, a constellation traces between 4-6 nearby
       stars, holds, fades. No cursor interaction. Pure ambience.
       ========================================================= */
    const AC_MAX_NODES = 6;
    const acGeo = new THREE.BufferGeometry();
    const acPos = new Float32Array((AC_MAX_NODES-1) * 6);     // segments between nodes
    const acCol = new Float32Array((AC_MAX_NODES-1) * 6);
    acGeo.setAttribute('position', new THREE.BufferAttribute(acPos, 3));
    acGeo.setAttribute('color', new THREE.BufferAttribute(acCol, 3));
    const acLines = new THREE.LineSegments(acGeo, new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0.85,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false
    }));
    acLines.frustumCulled = false;
    acLines.renderOrder = 2;
    scene.add(acLines);
    // small glow markers on each active node
    const acGlowGeo = new THREE.BufferGeometry();
    const acGlowPos = new Float32Array(AC_MAX_NODES * 3);
    const acGlowCol = new Float32Array(AC_MAX_NODES * 3);
    acGlowGeo.setAttribute('position', new THREE.BufferAttribute(acGlowPos, 3));
    acGlowGeo.setAttribute('color', new THREE.BufferAttribute(acGlowCol, 3));
    const acGlow = new THREE.Points(acGlowGeo, new THREE.PointsMaterial({
      size: 9, map: sprite, vertexColors: true, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true, fog: false
    }));
    acGlow.frustumCulled = false;
    acGlow.renderOrder = 2;
    scene.add(acGlow);
    // current constellation state
    let ac = null;
    let acNextAt = 4;                                // first one a few seconds in
    const _acProj = new THREE.Vector3();


    /* =========================================================
       COSMIC WEB — living filaments + glowing hubs + pulses
       ========================================================= */
    const NW = innerWidth < 760 ? 14 : 20;
    const webNodes = [];
    for (let i = 0; i < NW; i++) {
      webNodes.push({
        bx: (Math.random()-0.5)*150, by: (Math.random()-0.5)*90, bz: -120 - Math.random()*260,
        r: Math.random()*1.6+0.9, gold: Math.random()<0.45,
        dph: Math.random()*6.28, dsp: Math.random()*0.7+0.4, damp: Math.random()*7+4,
        dph2: Math.random()*6.28, dsp2: Math.random()*0.6+0.3,
        x:0, y:0, z:0
      });
    }
    const webLinks = [];
    for (let i = 0; i < NW; i++) {
      webLinks.push([i, (i*3+2)%NW]);
      if (Math.random()<0.5) webLinks.push([i, (i*5+1)%NW]);
    }
    // node points
    const webGeo = new THREE.BufferGeometry();
    const wPos = new Float32Array(NW*3), wCol = new Float32Array(NW*3);
    webNodes.forEach((n,i)=>{ const c = n.gold?cG:cB; wCol[i*3]=c.r; wCol[i*3+1]=c.g; wCol[i*3+2]=c.b; });
    webGeo.setAttribute('position', new THREE.BufferAttribute(wPos, 3));
    webGeo.setAttribute('color', new THREE.BufferAttribute(wCol, 3));
    const webPoints = new THREE.Points(webGeo, new THREE.PointsMaterial({
      size: 7, map: sprite, vertexColors: true, transparent: true,
      opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true, fog: false
    }));
    webPoints.renderOrder = -1;
    scene.add(webPoints);
    // filament lines
    const lineGeo = new THREE.BufferGeometry();
    const lPos = new Float32Array(webLinks.length*6), lCol = new Float32Array(webLinks.length*6);
    webLinks.forEach((lk,i)=>{
      const a=webNodes[lk[0]], b=webNodes[lk[1]];
      const ca=a.gold?cG:cB, cb=b.gold?cG:cB;
      lCol[i*6]=ca.r; lCol[i*6+1]=ca.g; lCol[i*6+2]=ca.b;
      lCol[i*6+3]=cb.r; lCol[i*6+4]=cb.g; lCol[i*6+5]=cb.b;
    });
    lineGeo.setAttribute('position', new THREE.BufferAttribute(lPos, 3));
    lineGeo.setAttribute('color', new THREE.BufferAttribute(lCol, 3));
    const webLines = new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, fog: false
    }));
    webLines.renderOrder = -1;
    scene.add(webLines);
    // energy pulses (points riding the links)
    const PUL = webLinks.length;
    const pulseGeo = new THREE.BufferGeometry();
    const pPos = new Float32Array(PUL*3);
    pulseGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    const pulses = webLinks.map((lk,i)=>({ link:i, t:Math.random(), sp:Math.random()*0.006+0.003 }));
    const pulsePoints = new THREE.Points(pulseGeo, new THREE.PointsMaterial({
      size: 9, map: sprite, color: new THREE.Color(0xffffff), transparent: true,
      opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true, fog: false
    }));
    pulsePoints.renderOrder = 0;
    scene.add(pulsePoints);

    /* =========================================================
       BLACK HOLES — dark core + accretion ring + lensing halo
       ========================================================= */
    function makeHoleTexture() {
      const S = 256, cnv = document.createElement('canvas'); cnv.width=cnv.height=S;
      const g = cnv.getContext('2d'); const cx=S/2;
      const rg = g.createRadialGradient(cx,cx,S*0.18,cx,cx,S*0.5);
      rg.addColorStop(0, 'rgba(0,0,0,0)');
      rg.addColorStop(0.42, 'rgba(0,0,0,0.95)');
      rg.addColorStop(0.6, 'rgba(255,170,70,0.9)');
      rg.addColorStop(0.7, 'rgba(255,230,180,0.85)');
      rg.addColorStop(0.82, 'rgba(120,170,255,0.4)');
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = rg; g.fillRect(0,0,S,S);
      // opaque black core
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = '#000'; g.beginPath(); g.arc(cx,cx,S*0.18,0,7); g.fill();
      return new THREE.CanvasTexture(cnv);
    }
    const holeTex = makeHoleTexture();
    const holes = [
      { z:-1500, x:0, y:0, s:90 },
    ];
    const holeSprites = holes.map(h => {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: holeTex, transparent: true, opacity: 0, depthWrite: false, depthTest: false, fog: false
      }));
      sp.position.set(h.x, h.y, h.z);
      sp.scale.setScalar(h.s);
      sp.renderOrder = 1;
      scene.add(sp);
      return { sp, base: h.s };
    });

    /* =========================================================
       COMETS — roaming shooting stars (whole journey)
       ========================================================= */
    const comets = [];
    function spawnComet(camZ) {
      const startZ = camZ - 80 - Math.random()*120;
      comets.push({
        x: (Math.random()-0.5)*180, y: (Math.random()-0.3)*120, z: startZ,
        vx: (Math.random()-0.5)*70, vy: -(Math.random()*40+30), vz: 0,
        life: 0, max: 1.6
      });
    }
    let nextComet = 2.5;
    // comet head + tail rendered as a short line each
    const cometGeo = new THREE.BufferGeometry();
    const cometMaxPts = 24;
    const cmPos = new Float32Array(cometMaxPts*6), cmCol = new Float32Array(cometMaxPts*6);
    cometGeo.setAttribute('position', new THREE.BufferAttribute(cmPos, 3));
    cometGeo.setAttribute('color', new THREE.BufferAttribute(cmCol, 3));
    const cometLines = new THREE.LineSegments(cometGeo, new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, fog: false
    }));
    cometLines.frustumCulled = false;
    scene.add(cometLines);

    // --- load the real GLB star model ---
    const star = new THREE.Group();
    star.position.set(0, 0, 14);
    scene.add(star);

    /* =========================================================
       PAGE-WIDE NEURAL MESH — linear filaments, blue/gold split
       Two layers: nodes BEHIND the star (renderOrder < star) and
       nodes IN FRONT around the rest of the viewport.
       Inspired by the Afenix logo: mesh wraps behind/around the star.
       ========================================================= */
    // World-space half-extents for the mesh at z = 0 plane
    const _meshFOV = camera.fov * Math.PI / 180;
    const _meshDist = 60;                                    // camera start z
    const meshH = 2 * Math.tan(_meshFOV / 2) * _meshDist;
    const meshW = meshH * (innerWidth / innerHeight);
    const starWorldR = 18;                                   // approx star footprint radius
    // Poisson-disk-style scatter in world space (simple dart-throw with rejection)
    function scatterNodes(targetCount, minDist, halfW, halfH) {
      const out = [];
      const tries = targetCount * 25;
      for (let i = 0; i < tries && out.length < targetCount; i++) {
        const x = (Math.random()*2 - 1) * halfW;
        const y = (Math.random()*2 - 1) * halfH;
        let ok = true;
        for (const o of out) {
          if (Math.hypot(o.x-x, o.y-y) < minDist) { ok = false; break; }
        }
        if (ok) out.push({ x, y });
      }
      return out;
    }
    const halfW = meshW * 0.5, halfH = meshH * 0.5;
    const minDist = Math.min(meshW, meshH) * 0.10;
    const rawNodes = scatterNodes(60, minDist, halfW, halfH);
    // Split into back (inside star footprint) and front (outside)
    const meshFront = [], meshBack = [];
    for (const p of rawNodes) {
      const node = {
        bx: p.x, by: p.y, x: p.x, y: p.y,
        side: p.x > 0 ? 'gold' : 'blue',
        r: Math.random()*0.6 + 0.5,
        ph: Math.random()*Math.PI*2,
        sp: Math.random()*0.7 + 0.3
      };
      (Math.hypot(p.x, p.y) < starWorldR ? meshBack : meshFront).push(node);
    }
    // Build link lists by proximity
    function linkSet(set, rad) {
      const out = [];
      for (let i = 0; i < set.length; i++)
        for (let j = i+1; j < set.length; j++)
          if (Math.hypot(set[i].bx-set[j].bx, set[i].by-set[j].by) < rad)
            out.push([i, j]);
      return out;
    }
    const linkRad = minDist * 2.0;
    const meshLinksFront = linkSet(meshFront, linkRad);
    const meshLinksBack  = linkSet(meshBack, linkRad);
    // Bridge: nearest front-node for each back-node, so the web visibly wraps
    const meshBridges = [];                                 // [backIdx, frontIdx]
    for (let bi = 0; bi < meshBack.length; bi++) {
      let best = -1, bestD = Infinity;
      for (let fi = 0; fi < meshFront.length; fi++) {
        const d = Math.hypot(meshBack[bi].bx-meshFront[fi].bx, meshBack[bi].by-meshFront[fi].by);
        if (d < linkRad*1.3 && d < bestD) { bestD = d; best = fi; }
      }
      if (best >= 0) meshBridges.push([bi, best]);
    }
    // Builder for one layer's THREE objects: returns { update(t, opacity) }
    function buildMeshLayer(nodes, links, bridgesAsExtra, opts) {
      // node points
      const nGeo = new THREE.BufferGeometry();
      const nPos = new Float32Array(nodes.length * 3);
      const nCol = new Float32Array(nodes.length * 3);
      for (let i = 0; i < nodes.length; i++) {
        const c = nodes[i].side === 'blue' ? cB : cG;
        nCol[i*3]=c.r; nCol[i*3+1]=c.g; nCol[i*3+2]=c.b;
      }
      nGeo.setAttribute('position', new THREE.BufferAttribute(nPos, 3));
      nGeo.setAttribute('color', new THREE.BufferAttribute(nCol, 3));
      const points = new THREE.Points(nGeo, new THREE.PointsMaterial({
        size: opts.dotSize, map: sprite, vertexColors: true, transparent: true,
        opacity: opts.dotOpacity, blending: THREE.AdditiveBlending, depthWrite: false,
        sizeAttenuation: true, fog: false
      }));
      points.frustumCulled = false;
      points.renderOrder = opts.renderOrder;
      scene.add(points);
      // line filaments — straight segments, vertex colors blended
      const totalLinks = links.length + (bridgesAsExtra ? bridgesAsExtra.length : 0);
      const lGeo = new THREE.BufferGeometry();
      const lPos = new Float32Array(totalLinks * 6);
      const lCol = new Float32Array(totalLinks * 6);
      lGeo.setAttribute('position', new THREE.BufferAttribute(lPos, 3));
      lGeo.setAttribute('color', new THREE.BufferAttribute(lCol, 3));
      const lines = new THREE.LineSegments(lGeo, new THREE.LineBasicMaterial({
        vertexColors: true, transparent: true, opacity: opts.lineOpacity,
        blending: THREE.AdditiveBlending, depthWrite: false, fog: false
      }));
      lines.frustumCulled = false;
      lines.renderOrder = opts.renderOrder;
      scene.add(lines);
      return {
        nodes, links, points, lines, nPos, nGeo, lPos, lGeo,
        baseDot: opts.dotOpacity, baseLine: opts.lineOpacity,
        bridgesAsExtra: bridgesAsExtra || null,
        update(t, vis) {
          // breathe nodes
          for (let i = 0; i < nodes.length; i++) {
            const n = nodes[i];
            n.x = n.bx + Math.sin(t*n.sp + n.ph) * 1.4;
            n.y = n.by + Math.cos(t*n.sp*0.8 + n.ph) * 1.2;
            nPos[i*3]   = n.x;
            nPos[i*3+1] = n.y;
            nPos[i*3+2] = 0;
          }
          nGeo.attributes.position.needsUpdate = true;
          // links
          let li = 0;
          for (const lk of links) {
            const a = nodes[lk[0]], b = nodes[lk[1]];
            const ca = a.side === 'blue' ? cB : cG;
            const cb = b.side === 'blue' ? cB : cG;
            lPos[li*6]   = a.x; lPos[li*6+1] = a.y; lPos[li*6+2] = 0;
            lPos[li*6+3] = b.x; lPos[li*6+4] = b.y; lPos[li*6+5] = 0;
            lCol[li*6]=ca.r; lCol[li*6+1]=ca.g; lCol[li*6+2]=ca.b;
            lCol[li*6+3]=cb.r; lCol[li*6+4]=cb.g; lCol[li*6+5]=cb.b;
            li++;
          }
          // bridges (back -> front nodes; need access to the OTHER layer's nodes)
          if (this.bridgesAsExtra && this.bridgePartner) {
            for (const [bi, fi] of this.bridgesAsExtra) {
              const a = nodes[bi];
              const b = this.bridgePartner.nodes[fi];
              const ca = a.side === 'blue' ? cB : cG;
              const cb = b.side === 'blue' ? cB : cG;
              lPos[li*6]   = a.x; lPos[li*6+1] = a.y; lPos[li*6+2] = 0;
              lPos[li*6+3] = b.x; lPos[li*6+4] = b.y; lPos[li*6+5] = 0;
              lCol[li*6]=ca.r; lCol[li*6+1]=ca.g; lCol[li*6+2]=ca.b;
              lCol[li*6+3]=cb.r; lCol[li*6+4]=cb.g; lCol[li*6+5]=cb.b;
              li++;
            }
          }
          lGeo.attributes.position.needsUpdate = true;
          lGeo.attributes.color.needsUpdate = true;
          points.material.opacity = this.baseDot * vis;
          lines.material.opacity = this.baseLine * vis;
        }
      };
    }
    // Back layer: BEHIND the star. Place at z slightly negative.
    const meshBackLayer = buildMeshLayer(meshBack, meshLinksBack, meshBridges, {
      dotSize: 2.6, dotOpacity: 0.45, lineOpacity: 0.10, renderOrder: -1
    });
    meshBackLayer.points.position.z = -2;
    meshBackLayer.lines.position.z = -2;
    // Front layer: in front of star background but behind UI text.
    const meshFrontLayer = buildMeshLayer(meshFront, meshLinksFront, null, {
      dotSize: 3.0, dotOpacity: 0.55, lineOpacity: 0.14, renderOrder: 1
    });
    meshFrontLayer.points.position.z = 2;
    meshFrontLayer.lines.position.z = 2;
    // Allow back-layer bridges to reference front-layer nodes
    meshBackLayer.bridgePartner = meshFrontLayer;


    const loader = new THREE.GLTFLoader();
    const glbURI = 'data:model/gltf-binary;base64,' + STAR_GLB_B64;
    loader.load(glbURI, (gltf) => {
      const model = gltf.scene;

      // Override material: keep geometry, apply rich metallic + emissive glow
      model.traverse(child => {
        if (!child.isMesh) return;
        child.castShadow = false;
        child.receiveShadow = false;
        child.material = new THREE.MeshStandardMaterial({
          color: 0xd4a060,
          metalness: 0.95,
          roughness: 0.12,
          emissive: new THREE.Color(0x4aa6ff),
          emissiveIntensity: 0.8,          // glow on the star, not flooding the page
          side: THREE.DoubleSide,
        });
      });

      // The model is flat (like a coin lying on a table — Y is thin, XZ is wide).
      // Rotate 90° on X so it stands upright and faces the camera.
      model.rotation.x = -Math.PI / 2;

      // After rotating, re-measure the bounding box so scale is correct
      model.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const targetSize = 32;                        // much bigger — dominant in scene
      model.scale.setScalar(targetSize / maxDim);

      // Re-center after scale
      model.updateMatrixWorld(true);
      const box2 = new THREE.Box3().setFromObject(model);
      const center = box2.getCenter(new THREE.Vector3());
      model.position.sub(center);

      star.add(model);
    }, undefined, (err) => {
      console.warn('GLB load failed, using fallback star', err);
      // Fallback: simple procedural star if GLB path fails
      function tri(rot, color) {
        const s = 11, h = s * Math.sqrt(3);
        const shape = new THREE.Shape();
        shape.moveTo(0, h*2/3); shape.lineTo(-s, -h/3); shape.lineTo(s, -h/3); shape.lineTo(0, h*2/3);
        const k = 0.64, hole = new THREE.Path();
        hole.moveTo(0, h*2/3*k); hole.lineTo(-s*k, -h/3*k); hole.lineTo(s*k, -h/3*k); hole.lineTo(0, h*2/3*k);
        shape.holes.push(hole);
        const g = new THREE.ExtrudeGeometry(shape, { depth: 1.4, bevelEnabled: true, bevelThickness: 0.5, bevelSize: 0.5, bevelSegments: 2 });
        const m = new THREE.MeshStandardMaterial({ color, metalness: 0.92, roughness: 0.22, emissive: color, emissiveIntensity: 0.3 });
        const mesh = new THREE.Mesh(g, m); mesh.rotation.z = rot; return mesh;
      }
      star.add(tri(0, C.blue));
      star.add(tri(Math.PI, C.gold));
      star.scale.setScalar(0.7);
    });

    scene.add(new THREE.AmbientLight(0x3a5590, 0.5));
    const l1 = new THREE.PointLight(C.blue, 1.6, 200); l1.position.set(-40, 25, 40); scene.add(l1);
    const l2 = new THREE.PointLight(C.gold, 1.4, 200); l2.position.set(40, -20, 40); scene.add(l2);
    const l3 = new THREE.PointLight(0xffffff, 0.8, 120); l3.position.set(0, 0, 50); scene.add(l3);
    const l4 = new THREE.PointLight(C.blueBright, 1.0, 160); l4.position.set(0, 30, 20); scene.add(l4);

    let mx = 0, my = 0;
    addEventListener('mousemove', e => { mx = e.clientX/innerWidth - 0.5; my = e.clientY/innerHeight - 0.5; }, { passive: true });

    const maxScroll = () => Math.max(1, document.body.scrollHeight - innerHeight);
    const clock = new THREE.Clock();

    // smoothstep stage envelope: peaks at center c, width w
    const stage = (p, c, w) => { const d = Math.abs(p-c)/w; return d>=1?0:(1 - d*d*(3-2*d)); };

    function render() {
      const t = clock.getElapsedTime();
      scrollEased += (scrollY - scrollEased) * 0.08;
      const prog = scrollEased / maxScroll();      // 0..1 down the page
      const camZ = 60 - prog * 1700;               // fly far down -Z through the journey

      // ---- twinkling starfield ----
      const sp = sfGeo.attributes.position.array, scl = sfGeo.attributes.color.array;
      for (let i = 0; i < SF; i++) {
        const tw = (0.35 + 0.65*Math.pow(0.5+0.5*Math.sin(t*sfSp[i]+sfPh[i]),3)) * sfBri[i];
        scl[i*3]=sfBase[i*3]*tw; scl[i*3+1]=sfBase[i*3+1]*tw; scl[i*3+2]=sfBase[i*3+2]*tw;
        if (sp[i*3+2] > camZ + 60) sp[i*3+2] -= SF_DEPTH;
        else if (sp[i*3+2] < camZ - SF_DEPTH) sp[i*3+2] += SF_DEPTH;
      }
      sfGeo.attributes.color.needsUpdate = true;
      sfGeo.attributes.position.needsUpdate = true;
      starfield.position.set(-mx*6, my*5, 0);

      // ---- Ambient Constellations: cosmos quietly draws itself ----
      // Spawn a new constellation periodically. Each draws in, holds, fades out.
      if (!ac && t > acNextAt) {
        // pick a seed star that is currently visible in front of the camera
        const tries = 40;
        let seedI = -1, seedNDC = null;
        for (let q = 0; q < tries; q++) {
          const cand = Math.floor(Math.random() * SF);
          _acProj.set(sfPos[cand*3], sfPos[cand*3+1], sfPos[cand*3+2]).project(camera);
          if (_acProj.z > -1 && _acProj.z < 1 &&
              Math.abs(_acProj.x) < 0.7 && Math.abs(_acProj.y) < 0.7) {
            seedI = cand;
            seedNDC = { x: _acProj.x, y: _acProj.y };
            break;
          }
        }
        if (seedI >= 0) {
          // gather screen-space neighbors of the seed
          const neighbors = [];
          for (let i = 0; i < SF; i++) {
            if (i === seedI) continue;
            _acProj.set(sfPos[i*3], sfPos[i*3+1], sfPos[i*3+2]).project(camera);
            if (_acProj.z < -1 || _acProj.z > 1) continue;
            const dx = _acProj.x - seedNDC.x, dy = _acProj.y - seedNDC.y;
            const d = Math.sqrt(dx*dx + dy*dy);
            if (d < 0.25) neighbors.push({ i, d, ang: Math.atan2(dy, dx) });
          }
          neighbors.sort((a,b) => a.d - b.d);
          const want = 3 + Math.floor(Math.random() * 3);          // 3..5 extra → 4..6 nodes total
          const picked = neighbors.slice(0, Math.min(want, neighbors.length));
          if (picked.length >= 3) {
            // order by angle around seed for an organic polyline (avoid harsh zigzag)
            picked.sort((a,b) => a.ang - b.ang);
            const nodeIdx = [seedI, ...picked.map(p => p.i)];
            ac = {
              nodes: nodeIdx,                          // star indices
              t0: t,
              lifeIn: 2.0,                             // seconds to draw
              hold: 3.0,                               // hold steady
              lifeOut: 2.0                             // fade out
            };
          }
        }
        // even if we couldn't form one, push next attempt a bit later
        if (!ac) acNextAt = t + 1.5;
      }

      // animate current constellation
      let acDrew = false;
      if (ac) {
        const age = t - ac.t0;
        const total = ac.lifeIn + ac.hold + ac.lifeOut;
        let aGlobal;
        if (age < ac.lifeIn)                aGlobal = age / ac.lifeIn;
        else if (age < ac.lifeIn + ac.hold) aGlobal = 1;
        else if (age < total)               aGlobal = 1 - (age - ac.lifeIn - ac.hold) / ac.lifeOut;
        else { ac = null; acNextAt = t + 4 + Math.random() * 5; }

        if (ac) {
          const nNodes = ac.nodes.length;
          const segs = nNodes - 1;
          // segment-by-segment progressive draw during fade-in
          for (let i = 0; i < AC_MAX_NODES - 1; i++) {
            if (i < segs) {
              let segA;
              if (age < ac.lifeIn) {
                const segDur = ac.lifeIn / segs;
                const segStart = i * segDur;
                segA = Math.max(0, Math.min(1, (age - segStart) / segDur));
              } else {
                segA = 1;
              }
              const aIdx = ac.nodes[i] * 3, bIdx = ac.nodes[i+1] * 3;
              const ax = sfPos[aIdx], ay = sfPos[aIdx+1], az = sfPos[aIdx+2];
              const bx = sfPos[bIdx], by = sfPos[bIdx+1], bz = sfPos[bIdx+2];
              const ix = ax + (bx - ax) * segA;
              const iy = ay + (by - ay) * segA;
              const iz = az + (bz - az) * segA;
              acPos[i*6]   = ax; acPos[i*6+1] = ay; acPos[i*6+2] = az;
              acPos[i*6+3] = ix; acPos[i*6+4] = iy; acPos[i*6+5] = iz;
              const aColor = aGlobal * 0.6;
              // gradient: blue → gold along the polyline
              const ti = i / Math.max(1, segs - 1);
              acCol[i*6]   = (0.29 + ti*0.62) * aColor;
              acCol[i*6+1] = (0.65 + ti*0.06) * aColor;
              acCol[i*6+2] = (1.00 - ti*0.60) * aColor;
              acCol[i*6+3] = acCol[i*6];     // same gradient endpoints for a cleaner look
              acCol[i*6+4] = acCol[i*6+1];
              acCol[i*6+5] = acCol[i*6+2];
            } else {
              for (let q = 0; q < 6; q++) { acPos[i*6+q] = 0; acCol[i*6+q] = 0; }
            }
          }
          // node glow markers, lit progressively
          for (let i = 0; i < AC_MAX_NODES; i++) {
            if (i < nNodes) {
              const reached = age < ac.lifeIn ? (i / Math.max(1, segs)) <= (age / ac.lifeIn) : 1;
              const aDot = reached ? aGlobal : 0;
              const idx = ac.nodes[i] * 3;
              acGlowPos[i*3]   = sfPos[idx];
              acGlowPos[i*3+1] = sfPos[idx+1];
              acGlowPos[i*3+2] = sfPos[idx+2];
              acGlowCol[i*3]   = 0.95 * aDot;
              acGlowCol[i*3+1] = 0.85 * aDot;
              acGlowCol[i*3+2] = 0.65 * aDot;
            } else {
              acGlowPos[i*3] = 0; acGlowPos[i*3+1] = 0; acGlowPos[i*3+2] = 0;
              acGlowCol[i*3] = 0; acGlowCol[i*3+1] = 0; acGlowCol[i*3+2] = 0;
            }
          }
          acDrew = true;
        }
      }
      if (!acDrew) {
        // clear buffers when nothing is active
        for (let i = 0; i < (AC_MAX_NODES-1)*6; i++) { acPos[i] = 0; acCol[i] = 0; }
        for (let i = 0; i < AC_MAX_NODES*3; i++) { acGlowPos[i] = 0; acGlowCol[i] = 0; }
      }
      acGeo.attributes.position.needsUpdate = true;
      acGeo.attributes.color.needsUpdate = true;
      acGlowGeo.attributes.position.needsUpdate = true;
      acGlowGeo.attributes.color.needsUpdate = true;

      // ---- cosmic web: appears prog 0.12..0.55, lives in mid-depth ----
      const webA = stage(prog, 0.32, 0.28);
      const webCenterZ = camZ - 220;
      webNodes.forEach((n,i)=>{
        const dx = Math.sin(t*n.dsp+n.dph)*n.damp + Math.sin(t*n.dsp2*1.7+n.dph2)*n.damp*0.5;
        const dy = Math.cos(t*n.dsp*0.85+n.dph2)*n.damp + Math.cos(t*n.dsp2*1.3+n.dph)*n.damp*0.5;
        n.x = n.bx + dx; n.y = n.by + dy; n.z = webCenterZ + n.bz + 200;
        wPos[i*3]=n.x; wPos[i*3+1]=n.y; wPos[i*3+2]=n.z;
      });
      webGeo.attributes.position.needsUpdate = true;
      webPoints.material.opacity = webA;
      // lines
      webLinks.forEach((lk,i)=>{
        const a=webNodes[lk[0]], b=webNodes[lk[1]];
        lPos[i*6]=a.x; lPos[i*6+1]=a.y; lPos[i*6+2]=a.z;
        lPos[i*6+3]=b.x; lPos[i*6+4]=b.y; lPos[i*6+5]=b.z;
      });
      lineGeo.attributes.position.needsUpdate = true;
      webLines.material.opacity = webA * 0.5;
      // pulses
      pulses.forEach((pu,i)=>{
        pu.t += pu.sp; if (pu.t>1) pu.t -= 1;
        const lk=webLinks[pu.link], a=webNodes[lk[0]], b=webNodes[lk[1]];
        pPos[i*3]=a.x+(b.x-a.x)*pu.t; pPos[i*3+1]=a.y+(b.y-a.y)*pu.t; pPos[i*3+2]=a.z+(b.z-a.z)*pu.t;
      });
      pulseGeo.attributes.position.needsUpdate = true;
      pulsePoints.material.opacity = webA;

      // ---- black hole: prog 0.78..1.0 ----
      const holeA = stage(prog, 0.9, 0.16);
      holeSprites.forEach(h=>{
        h.sp.material.opacity = holeA;
        h.sp.position.z = camZ - 240;
        h.sp.scale.setScalar(h.base * (0.6 + 0.4*holeA));
      });

      // ---- comets (whole journey) ----
      if (t > nextComet) { spawnComet(camZ); nextComet = t + Math.random()*5 + 3; }
      let ci = 0;
      for (let k = comets.length-1; k >= 0; k--) {
        const cm = comets[k];
        cm.life += 0.016;
        if (cm.life > cm.max) { comets.splice(k,1); continue; }
        cm.x += cm.vx*0.016; cm.y += cm.vy*0.016;
        if (ci < cometMaxPts) {
          const fade = Math.sin((cm.life/cm.max)*Math.PI);
          const tailLen = 0.12;
          const hx=cm.x, hy=cm.y, hz=cm.z;
          const tx=cm.x - cm.vx*tailLen, ty=cm.y - cm.vy*tailLen, tz=cm.z;
          cmPos[ci*6]=tx; cmPos[ci*6+1]=ty; cmPos[ci*6+2]=tz;
          cmPos[ci*6+3]=hx; cmPos[ci*6+4]=hy; cmPos[ci*6+5]=hz;
          cmCol[ci*6]=0; cmCol[ci*6+1]=0; cmCol[ci*6+2]=0;
          cmCol[ci*6+3]=0.8*fade; cmCol[ci*6+4]=0.88*fade; cmCol[ci*6+5]=fade;
          ci++;
        }
      }
      for (let k = ci; k < cometMaxPts; k++) { for (let q=0;q<6;q++){ cmPos[k*6+q]=0; cmCol[k*6+q]=0; } }
      cometGeo.attributes.position.needsUpdate = true;
      cometGeo.attributes.color.needsUpdate = true;

      // ---- camera dolly + parallax ----
      camera.position.z = camZ;
      camera.position.x += (mx * 16 - camera.position.x) * 0.05;
      camera.position.y += (-my * 12 - camera.position.y) * 0.05;
      camera.rotation.z = mx * 0.04;
      camera.lookAt(camera.position.x * 0.4, camera.position.y * 0.4, camera.position.z - 60);

      // ---- star: stays in hero, recedes & fades as you leave ----
      star.rotation.y = t * 0.18 + mx * 0.6;
      star.rotation.x = my * 0.35;
      star.position.y = Math.sin(t * 0.6) * 0.8;
      star.position.z = 14 - prog * 80;
      const starA = Math.max(0, 1 - prog/0.3);
      star.traverse(child => {
        if (child.isMesh && child.material && child.material.emissive) {
          const pulse = 0.5 + 0.5 * Math.sin(t * 0.7);
          child.material.emissive.setRGB(0.29 + pulse*0.62, 0.65 + pulse*0.07, 1.00 - pulse*0.90);
          child.material.emissiveIntensity = (0.6 + 0.4*Math.sin(t*1.1)) * (0.3 + 0.7*starA);
          child.material.opacity = starA;
          child.material.transparent = true;
        }
      });
      l3.position.x = mx*40; l3.position.y = -my*26;

      // ---- page-wide neural mesh: update both layers, fade with star ----
      meshFrontLayer.update(t, starA);
      meshBackLayer.update(t, starA);


      renderer.render(scene, camera);
      requestAnimationFrame(render);
    }
    render();

    addEventListener('resize', () => {
      camera.aspect = innerWidth/innerHeight; camera.updateProjectionMatrix();
      renderer.setSize(innerWidth, innerHeight);
    });
  }

  /* =========================================================
     2 · FORCE-DIRECTED GRAPH — grab & fling (real physics)
     Springs hold linked nodes; all nodes repel; drag to throw.
     This is the "different/better" physics demo.
     ========================================================= */
  function forceGraph() {
    const cv = document.getElementById('graph');
    if (!cv) return;
    const ctx = cv.getContext('2d');
    let W, H, dpr;
    const LABELS = ['HR', 'Finance', 'Sales', 'Ops', 'Support', 'Legal', 'Docs', 'RAG', 'Core'];
    let nodes = [], edges = [], drag = null, hover = null, mouse = { x: -1e4, y: -1e4 };

    function size() {
      dpr = Math.min(devicePixelRatio, 2);
      const r = cv.parentElement.getBoundingClientRect();
      W = r.width; H = r.height;
      cv.width = W*dpr; cv.height = H*dpr; cv.style.width = W+'px'; cv.style.height = H+'px';
      ctx.setTransform(dpr,0,0,dpr,0,0);
      if (!nodes.length) build();
    }
    function build() {
      nodes = LABELS.map((l, i) => ({
        l, i,
        x: W/2 + (Math.random()-0.5)*W*0.5,
        y: H/2 + (Math.random()-0.5)*H*0.5,
        vx: 0, vy: 0,
        core: l === 'Core',
        gold: i % 3 === 1,
        r: l === 'Core' ? 24 : 15,
      }));
      // Core links to all; plus a ring of neighbour links
      edges = [];
      const core = nodes.find(n => n.core);
      nodes.forEach(n => { if (!n.core) edges.push([core, n]); });
      for (let i = 0; i < nodes.length; i++) {
        if (nodes[i].core) continue;
        const a = nodes[i], b = nodes[(i+2) % nodes.length];
        if (!b.core) edges.push([a, b]);
      }
    }
    function physics() {
      // repulsion (Coulomb-ish)
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i+1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          let dx = a.x-b.x, dy = a.y-b.y, d2 = dx*dx+dy*dy || 0.01;
          const d = Math.sqrt(d2);
          const force = 2600 / d2;
          const fx = dx/d*force, fy = dy/d*force;
          a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
        }
      }
      // springs
      for (const [a, b] of edges) {
        let dx = b.x-a.x, dy = b.y-a.y, d = Math.hypot(dx, dy) || 0.01;
        const rest = a.core || b.core ? 120 : 96;
        const k = (d - rest) * 0.012;
        const fx = dx/d*k, fy = dy/d*k;
        a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
      }
      // centering + cursor repel + integrate
      const cx = W/2, cy = H/2;
      for (const n of nodes) {
        n.vx += (cx - n.x) * 0.0016;
        n.vy += (cy - n.y) * 0.0016;
        const dx = n.x - mouse.x, dy = n.y - mouse.y, d = Math.hypot(dx, dy);
        if (d < 90 && d > 0.1 && n !== drag) { const f = (1 - d/90) * 2.2; n.vx += dx/d*f; n.vy += dy/d*f; }
        if (n === drag) { n.vx = 0; n.vy = 0; n.x = mouse.x; n.y = mouse.y; }
        n.vx *= 0.9; n.vy *= 0.9;
        n.x += n.vx; n.y += n.vy;
        n.x = Math.max(n.r, Math.min(W - n.r, n.x));
        n.y = Math.max(n.r, Math.min(H - n.r, n.y));
      }
    }
    function draw() {
      physics();
      ctx.clearRect(0, 0, W, H);
      // edges
      for (const [a, b] of edges) {
        const g = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
        g.addColorStop(0, 'rgba(74,166,255,0.5)');
        g.addColorStop(1, 'rgba(232,182,103,0.5)');
        ctx.strokeStyle = g; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      // nodes
      for (const n of nodes) {
        const base = n.core ? '#ffffff' : (n.gold ? '#f6d79b' : '#7fd0ff');
        ctx.shadowBlur = n === hover || n === drag ? 26 : 14;
        ctx.shadowColor = n.gold ? '#e8b667' : '#4aa6ff';
        ctx.fillStyle = base;
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r + (n===hover?3:0), 0, 7); ctx.fill();
        ctx.shadowBlur = 0;
        if (n.core) {
          ctx.strokeStyle = 'rgba(120,180,255,0.6)'; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(n.x, n.y, n.r + 7, 0, 7); ctx.stroke();
        }
        ctx.fillStyle = n.core ? '#06101f' : 'rgba(6,16,31,0.92)';
        ctx.font = `${n.core ? 600 : 500} ${n.core ? 12 : 10}px Inter, sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(n.l, n.x, n.y);
      }
      requestAnimationFrame(draw);
    }
    function pt(e) {
      const r = cv.getBoundingClientRect();
      const cx = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
      const cy = (e.touches ? e.touches[0].clientY : e.clientY) - r.top;
      return { x: cx, y: cy };
    }
    function hit(p) { return nodes.find(n => Math.hypot(n.x-p.x, n.y-p.y) < n.r + 6); }
    cv.addEventListener('mousemove', e => { mouse = pt(e); hover = hit(mouse); cv.style.cursor = hover ? 'grab' : 'default'; });
    cv.addEventListener('mousedown', e => { drag = hit(pt(e)); if (drag) cv.style.cursor = 'grabbing'; });
    addEventListener('mouseup', () => { if (drag) { drag.vx = (Math.random()-0.5)*4; drag.vy = (Math.random()-0.5)*4; } drag = null; });
    cv.addEventListener('mouseleave', () => { mouse = { x: -1e4, y: -1e4 }; hover = null; });
    cv.addEventListener('touchstart', e => { mouse = pt(e); drag = hit(mouse); }, { passive: true });
    cv.addEventListener('touchmove', e => { mouse = pt(e); }, { passive: true });
    addEventListener('touchend', () => { drag = null; });
    size(); draw(); addEventListener('resize', size);
  }

  /* =========================================================
     3 · CUSTOM CURSOR (dot + lagging ring)
     ========================================================= */
  function cursor() {
    // custom cursor removed — using system default
    return;
  }

  /* =========================================================
     4 · SCROLL NARRATIVE (word-by-word lighting)
     ========================================================= */
  function narrative() {
    const vt = document.getElementById('vision');
    if (!vt) return;
    const text = vt.dataset.text || '';
    const boldIdx = (vt.dataset.bold || '').split(',').map(Number);
    text.split(' ').forEach((w, i) => {
      const s = document.createElement('span');
      s.className = 'vw' + (boldIdx.includes(i) ? ' vb' : '');
      s.textContent = w;
      s.style.marginRight = '0.26em';
      vt.appendChild(s);
    });
    const words = [...vt.querySelectorAll('.vw')];
    function upd() {
      const r = vt.getBoundingClientRect();
      const start = innerHeight*0.8, end = innerHeight*0.3;
      const p = Math.min(1, Math.max(0, (start - r.top)/(start - end)));
      const lit = Math.floor(p * words.length);
      words.forEach((w, i) => w.classList.toggle('lit', i < lit));
    }
    addEventListener('scroll', upd, { passive: true }); upd();
  }

  /* ---------- reveals, tilt, counters, magnetic, nav ---------- */
  function ui() {
    const rev = document.querySelectorAll('.reveal');
    const io = new IntersectionObserver((es) => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.15, rootMargin: '0px 0px -40px' });
    rev.forEach(r => io.observe(r));

    if (fine && !reduced) document.querySelectorAll('[data-tilt]').forEach(card => {
      card.addEventListener('mousemove', e => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX-r.left)/r.width, py = (e.clientY-r.top)/r.height;
        card.style.setProperty('--mx', px*100+'%');
        card.style.setProperty('--my', py*100+'%');
        card.style.transform = `perspective(900px) rotateY(${(px-0.5)*9}deg) rotateX(${(0.5-py)*9}deg) translateY(-6px)`;
      });
      card.addEventListener('mouseleave', () => card.style.transform = '');
    });

    if (fine && !reduced) document.querySelectorAll('.btn').forEach(btn => {
      btn.addEventListener('mousemove', e => {
        const r = btn.getBoundingClientRect();
        btn.style.transform = `translate(${(e.clientX-r.left-r.width/2)*0.25}px,${(e.clientY-r.top-r.height/2)*0.35}px)`;
      });
      btn.addEventListener('mouseleave', () => btn.style.transform = '');
    });

    const cObs = new IntersectionObserver((es) => es.forEach(en => {
      if (!en.isIntersecting) return;
      const el = en.target, target = parseFloat(el.dataset.count), suf = el.dataset.suffix || '';
      let v = 0; const t0 = performance.now(), dur = 1200;
      (function step(now) {
        const p = Math.min((now-t0)/dur, 1), e = 1 - Math.pow(1-p, 3);
        el.textContent = (target % 1 ? (e*target).toFixed(1) : Math.round(e*target)) + suf;
        if (p < 1) requestAnimationFrame(step);
      })(t0);
      cObs.unobserve(el);
    }), { threshold: 0.6 });
    document.querySelectorAll('[data-count]').forEach(c => cObs.observe(c));

    const nav = document.getElementById('nav');
    if (nav) { const f = () => nav.classList.toggle('scrolled', scrollY > 30); addEventListener('scroll', f, { passive: true }); f(); }

    document.querySelectorAll('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
      const id = a.getAttribute('href');
      if (id.length > 1) { const t = document.querySelector(id); if (t) { e.preventDefault(); t.scrollIntoView({ behavior: 'smooth' }); } }
    }));

    const form = document.querySelector('.cform');
    if (form) form.addEventListener('submit', e => {
      e.preventDefault();
      const b = form.querySelector('button[type=submit]'); if (!b) return;
      const x = b.textContent; b.textContent = 'Received — we’ll be in touch ✓'; form.reset();
      setTimeout(() => b.textContent = x, 3000);
    });
  }

  /* ---------- loader ---------- */
  function loader() {
    const ld = document.getElementById('loader');
    if (!ld) return;
    addEventListener('load', () => setTimeout(() => { ld.style.opacity = '0'; ld.style.visibility = 'hidden'; }, 600));
    setTimeout(() => { ld.style.opacity = '0'; ld.style.visibility = 'hidden'; }, 2600);
  }

  document.addEventListener('DOMContentLoaded', () => {
    loader(); cursor(); ui(); narrative(); forceGraph();
    if (!reduced) neuralField();
  });
})();
