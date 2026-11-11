      (() => {
        const TAU = Math.PI * 2;
        const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
        const localeText = (source) => {
          try {
            const data = window.__SALT_I18N__;
            const map = data && data.messages && data.messages.gameText;
            return (map && map[source]) || source;
          } catch {
            return source;
          }
        };
        const ui = document.createElement("div");
        ui.id = "sail-ui";
        ui.setAttribute("aria-hidden", "true");
        ui.innerHTML = `
          <div class="sail-top">
            <div class="sail-title"><i></i><div><span>自由航行</span><b>盐线 · 外海</b></div></div>
            <div class="sail-compass" aria-hidden="true">
              <div class="sail-tape"></div>
              <div class="sail-bearing"><span id="sail-dir">南</span><b id="sail-deg">180°</b></div>
            </div>
            <button class="sail-exit" data-sail="exit" type="button">返回简报</button>
          </div>
          <div class="sail-toast" id="sail-toast"></div>
          <div class="sail-speed"><span>航速</span><b id="sail-knots">0</b><em>节</em><div class="sail-bar" id="sail-bar"><i></i></div></div>
          <div class="sail-map"><canvas id="sail-map" width="168" height="168"></canvas><div><span id="sail-coords">31.5, 21.0</span><b id="sail-zone">近港</b></div></div>
          <div class="sail-help">W / S 推进 · A / D 转向 · 鼠标观察 · Shift 加速 · Esc 返回简报</div>
          <div class="sail-touch">
            <div class="sail-pad">
              <button class="sail-btn" data-sail-hold="forward" type="button" aria-label="推进">▲</button>
              <button class="sail-btn" data-sail-hold="left" type="button" aria-label="左转">◀</button>
              <button class="sail-btn" data-sail-hold="back" type="button" aria-label="倒车">▼</button>
              <button class="sail-btn" data-sail-hold="right" type="button" aria-label="右转">▶</button>
            </div>
            <button class="sail-btn boost" data-sail-hold="boost" type="button" aria-label="加速">加速</button>
          </div>`;
        document.getElementById("ui").appendChild(ui);

        const els = {
          dir: ui.querySelector("#sail-dir"),
          deg: ui.querySelector("#sail-deg"),
          knots: ui.querySelector("#sail-knots"),
          bar: ui.querySelector("#sail-bar"),
          barFill: ui.querySelector("#sail-bar i"),
          coords: ui.querySelector("#sail-coords"),
          zone: ui.querySelector("#sail-zone"),
          toast: ui.querySelector("#sail-toast"),
          map: ui.querySelector("#sail-map"),
        };
        const mapCtx = els.map.getContext("2d");
        const touch = { forward: 0, back: 0, left: 0, right: 0, boost: 0 };
        const heldPointers = new Map();
        const trail = [];
        const state = {
          heading: -Math.PI / 2,
          speed: 0,
          pitch: 0.02,
          roll: 0,
          x: 31.5,
          z: 21,
          hudTime: 0,
          trailTime: 0,
          warn: 0,
        };

        let G = null;
        let active = false;
        let wake = null;
        let wakeMaterial = null;
        let dockPose = null;
        let savedCamera = null;
        let savedPost = null;
        let toastTimer = 0;
        const lookTarget = { x: 0, y: 0, z: 0 };

        function ensureCompleteEntry() {
          const section = document.querySelector('.m-screen[data-s="complete"]');
          if (!section) return;
          const actions = section.querySelector(".m-actions");
          if (!actions) return;
          if (!section.querySelector("[data-sail-note]")) {
            const note = document.createElement("p");
            note.className = "m-line";
            note.setAttribute("data-sail-note", "");
            note.textContent = localeText("撤离成功。你也可以驾船离港，在整片外海自由航行。");
            actions.parentNode.insertBefore(note, actions);
          }
          if (section.querySelector("[data-sail-enter]")) return;
          const button = document.createElement("button");
          button.className = "btn primary";
          button.type = "button";
          button.setAttribute("data-sail-enter", "");
          button.textContent = localeText("驾船离港 · 自由航行");
          actions.prepend(button);
          const redeploy = actions.querySelector('[data-act="redeploy"]');
          if (redeploy) redeploy.classList.remove("primary");
        }

        function makeWakeTexture(THREE) {
          const canvas = document.createElement("canvas");
          canvas.width = 128;
          canvas.height = 256;
          const ctx = canvas.getContext("2d");
          const grad = ctx.createLinearGradient(0, 256, 0, 0);
          grad.addColorStop(0, "rgba(235,250,250,.9)");
          grad.addColorStop(0.45, "rgba(224,244,244,.46)");
          grad.addColorStop(1, "rgba(220,242,244,0)");
          ctx.strokeStyle = grad;
          ctx.lineCap = "round";
          ctx.lineWidth = 8;
          ctx.beginPath();
          ctx.moveTo(64, 254);
          ctx.bezierCurveTo(55, 196, 36, 96, 8, 9);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(64, 254);
          ctx.bezierCurveTo(73, 196, 92, 96, 120, 9);
          ctx.stroke();
          const churn = ctx.createRadialGradient(64, 226, 0, 64, 226, 42);
          churn.addColorStop(0, "rgba(240,252,252,.72)");
          churn.addColorStop(1, "rgba(240,252,252,0)");
          ctx.fillStyle = churn;
          ctx.fillRect(20, 184, 88, 72);
          const texture = new THREE.CanvasTexture(canvas);
          texture.needsUpdate = true;
          return texture;
        }

        function createWake() {
          if (wake || !G || !G.scene || !G.THREE) return;
          const THREE = G.THREE;
          const geometry = new THREE.PlaneGeometry(7.2, 18);
          geometry.rotateX(-Math.PI / 2);
          wakeMaterial = new THREE.MeshBasicMaterial({
            map: makeWakeTexture(THREE),
            color: 0xe8ffff,
            transparent: true,
            opacity: 0,
            depthWrite: false,
            side: THREE.DoubleSide,
            fog: true,
          });
          wake = new THREE.Mesh(geometry, wakeMaterial);
          wake.name = "sail-wake";
          wake.frustumCulled = false;
          wake.renderOrder = 4;
          wake.visible = false;
          G.scene.add(wake);
        }

        function setToast(text, duration = 2.4) {
          els.toast.textContent = localeText(text);
          els.toast.classList.add("on");
          clearTimeout(toastTimer);
          toastTimer = setTimeout(() => els.toast.classList.remove("on"), duration * 1000);
        }

        function blocked(x, z) {
          if (!Number.isFinite(x) || !Number.isFinite(z)) return true;
          if (x * x + z * z > 716 * 716) return true;
          if (x < 30.4 && x > -62 && z > -49 && z < 49) return true;
          return false;
        }

        function applyBoatPose() {
          if (!active || !G || !G.backdrop || !G.backdrop.boat) return;
          const boat = G.backdrop.boat;
          let sea = -1.6;
          try {
            if (G.ground && typeof G.ground.seaHeight === "function") sea = G.ground.seaHeight(state.x, state.z);
          } catch {}
          boat.position.set(state.x, sea + 0.035, state.z);
          boat.rotation.order = "YXZ";
          boat.rotation.y = state.heading;
          boat.rotation.z = state.roll;
        }

        function tick(dt, snap = false) {
          if (!active || !G) return;
          dt = clamp(dt || 0, 0, 0.05);
          const input = G.input || {};
          const look = input.look || { dx: 0, dy: 0 };

          state.heading -= look.dx || 0;
          state.pitch = clamp(state.pitch - (look.dy || 0) * 0.72, -0.22, 0.72);

          const throttle = clamp((input.move && input.move.y || 0) + touch.forward - touch.back, -1, 1);
          const steer = clamp((input.move && input.move.x || 0) + touch.right - touch.left, -1, 1);
          const boost = !!(input.sprint || touch.boost);
          const maxSpeed = boost ? 27 : 17;

          if (throttle > 0) state.speed += throttle * (boost ? 13 : 9.5) * dt;
          else if (throttle < 0) state.speed += throttle * 6.8 * dt;
          else state.speed -= Math.sign(state.speed) * Math.min(Math.abs(state.speed), 2.6 * dt);

          if (boost && state.speed > 0) state.speed += 4.5 * dt;
          if (state.speed > maxSpeed) state.speed = Math.max(maxSpeed, state.speed - 7 * dt);
          if (state.speed < -7) state.speed = -7;
          state.speed = clamp(state.speed, -7, maxSpeed);

          const steerAuthority = 0.52 + Math.min(0.52, Math.abs(state.speed) / 25);
          state.heading -= steer * steerAuthority * dt;
          state.heading = ((state.heading + Math.PI) % TAU + TAU) % TAU - Math.PI;

          const fx = Math.cos(state.heading);
          const fz = -Math.sin(state.heading);
          const nx = state.x + fx * state.speed * dt;
          const nz = state.z + fz * state.speed * dt;
          let hit = false;
          if (!blocked(nx, nz)) {
            state.x = nx;
            state.z = nz;
          } else if (!blocked(nx, state.z)) {
            state.x = nx;
            state.speed *= 0.55;
            hit = true;
          } else if (!blocked(state.x, nz)) {
            state.z = nz;
            state.speed *= 0.55;
            hit = true;
          } else {
            state.speed = 0;
            hit = true;
          }
          if (hit && state.warn <= 0) {
            state.warn = 3.2;
            setToast("浅水区 · 请绕行外海", 2.4);
          }
          state.warn = Math.max(0, state.warn - dt);

          const rollTarget = clamp(-steer * Math.min(1, Math.abs(state.speed) / 15) * 0.085, -0.085, 0.085);
          state.roll += (rollTarget - state.roll) * Math.min(1, dt * 4.2);

          let sea = -1.6;
          try {
            if (G.ground && typeof G.ground.seaHeight === "function") sea = G.ground.seaHeight(state.x, state.z);
          } catch {}

          const elevation = 0.28 + state.pitch;
          const distance = 13.2 + Math.min(2.6, Math.abs(state.speed) * 0.08) + (boost && state.speed > 1 ? 1.7 : 0);
          const camX = state.x - fx * Math.cos(elevation) * distance;
          const camZ = state.z - fz * Math.cos(elevation) * distance;
          const camY = sea + 1.15 + Math.sin(elevation) * distance;
          lookTarget.x = state.x + fx * 4.4;
          lookTarget.y = sea + 1.55;
          lookTarget.z = state.z + fz * 4.4;

          const camera = G.camera;
          if (camera) {
            if (snap) camera.position.set(camX, camY, camZ);
            else {
              const alpha = 1 - Math.exp(-dt * 7.5);
              camera.position.x += (camX - camera.position.x) * alpha;
              camera.position.y += (camY - camera.position.y) * alpha;
              camera.position.z += (camZ - camera.position.z) * alpha;
            }
            camera.lookAt(lookTarget.x, lookTarget.y, lookTarget.z);
            const targetFov = 60 + (boost && state.speed > 2 ? 7 : 0);
            if (Math.abs(camera.fov - targetFov) > 0.02) {
              camera.fov += (targetFov - camera.fov) * (snap ? 1 : Math.min(1, dt * 4));
              camera.updateProjectionMatrix();
            }
          }

          applyBoatPose();

          if (wake && wakeMaterial) {
            const amount = clamp(Math.abs(state.speed) / 15, 0, 1);
            wake.visible = amount > 0.035;
            wake.position.set(state.x - fx * 7.4, sea + 0.045, state.z - fz * 7.4);
            wake.rotation.y = state.heading - Math.PI / 2;
            wake.scale.set(0.8 + amount * 0.34, 1, 0.68 + amount * 0.5);
            const targetOpacity = amount * 0.58;
            wakeMaterial.opacity += (targetOpacity - wakeMaterial.opacity) * Math.min(1, dt * 5);
          }

          state.trailTime += dt;
          if (state.trailTime > 0.42) {
            state.trailTime = 0;
            trail.push({ x: state.x, z: state.z });
            if (trail.length > 90) trail.shift();
          }

          state.hudTime += dt;
          if (state.hudTime > 0.08) {
            state.hudTime = 0;
            updateHud();
            drawMap();
          }
        }

        function updateHud() {
          const bearing = (Math.PI / 2 - state.heading) * 180 / Math.PI;
          const deg = (bearing % 360 + 360) % 360;
          const names = ["北", "东北", "东", "东南", "南", "西南", "西", "西北"];
          els.dir.textContent = localeText(names[Math.round(deg / 45) % 8]);
          els.deg.textContent = `${Math.round(deg).toString().padStart(3, "0")}°`;
          els.knots.textContent = String(Math.round(Math.abs(state.speed) * 1.45));
          els.bar.classList.toggle("reverse", state.speed < -0.12);
          els.barFill.style.width = `${clamp(Math.abs(state.speed) / 27 * 100, 0, 100).toFixed(1)}%`;
          els.coords.textContent = `${state.x.toFixed(0)}, ${state.z.toFixed(0)}`;
          const fromPort = Math.hypot(state.x - 31.5, state.z - 21);
          els.zone.textContent = localeText(fromPort < 95 ? "近港" : fromPort < 310 ? "外海" : "远海");
        }

        function drawMap() {
          if (!mapCtx) return;
          const W = els.map.width;
          const cx = W / 2;
          const cy = W / 2;
          const radius = W * 0.47;
          const scale = radius / 160;
          const toX = (x) => cx + (x - state.x) * scale;
          const toY = (z) => cy + (z - state.z) * scale;

          mapCtx.setTransform(1, 0, 0, 1, 0, 0);
          mapCtx.clearRect(0, 0, W, W);
          mapCtx.save();
          mapCtx.beginPath();
          mapCtx.arc(cx, cy, radius, 0, TAU);
          mapCtx.clip();
          mapCtx.fillStyle = "rgba(7,15,18,.9)";
          mapCtx.fillRect(0, 0, W, W);

          mapCtx.strokeStyle = "rgba(138,170,176,.13)";
          mapCtx.lineWidth = 1;
          const grid = 25;
          const startX = Math.floor((state.x - 170) / grid) * grid;
          const startZ = Math.floor((state.z - 170) / grid) * grid;
          for (let gx = startX; gx <= state.x + 170; gx += grid) {
            const px = toX(gx);
            mapCtx.beginPath();
            mapCtx.moveTo(px, 0);
            mapCtx.lineTo(px, W);
            mapCtx.stroke();
          }
          for (let gz = startZ; gz <= state.z + 170; gz += grid) {
            const py = toY(gz);
            mapCtx.beginPath();
            mapCtx.moveTo(0, py);
            mapCtx.lineTo(W, py);
            mapCtx.stroke();
          }

          mapCtx.fillStyle = "#303a3b";
          mapCtx.strokeStyle = "rgba(224,216,198,.42)";
          mapCtx.lineWidth = 1;
          const landX = toX(-46);
          const landY = toY(-42);
          const landW = 76 * scale;
          const landH = 84 * scale;
          mapCtx.fillRect(landX, landY, landW, landH);
          mapCtx.strokeRect(landX, landY, landW, landH);

          mapCtx.fillStyle = "#6e6250";
          mapCtx.fillRect(toX(28), toY(-34), 7 * scale, 68 * scale);
          mapCtx.fillStyle = "rgba(255,179,71,.8)";
          mapCtx.fillRect(toX(30), toY(17), 4 * scale, 7 * scale);

          if (trail.length > 1) {
            mapCtx.strokeStyle = "rgba(144,214,220,.45)";
            mapCtx.lineWidth = 1.5;
            mapCtx.beginPath();
            for (let i = 0; i < trail.length; i++) {
              const p = trail[i];
              if (i === 0) mapCtx.moveTo(toX(p.x), toY(p.z));
              else mapCtx.lineTo(toX(p.x), toY(p.z));
            }
            mapCtx.stroke();
          }

          mapCtx.translate(cx, cy);
          mapCtx.rotate(Math.PI / 2 - state.heading);
          mapCtx.fillStyle = "#ffb347";
          mapCtx.beginPath();
          mapCtx.moveTo(0, -8);
          mapCtx.lineTo(5.4, 6);
          mapCtx.lineTo(0, 3.5);
          mapCtx.lineTo(-5.4, 6);
          mapCtx.closePath();
          mapCtx.fill();
          mapCtx.restore();

          mapCtx.strokeStyle = "rgba(232,228,218,.24)";
          mapCtx.lineWidth = 1;
          mapCtx.beginPath();
          mapCtx.arc(cx, cy, radius, 0, TAU);
          mapCtx.stroke();
          mapCtx.fillStyle = "rgba(232,228,218,.7)";
          mapCtx.font = '600 9px "IBM Plex Mono", monospace';
          mapCtx.textAlign = "center";
          mapCtx.fillText("N", cx, 13);
        }

        function enterSail() {
          if (active || !G || !G.game || !G.backdrop || !G.backdrop.boat) return;
          if (G.game.state !== "complete") {
            setToast("请先完成撤离", 1.8);
            return;
          }
          ensureCompleteEntry();
          const boat = G.backdrop.boat;
          dockPose = {
            x: boat.position.x,
            y: boat.position.y,
            z: boat.position.z,
            ry: boat.rotation.y,
            rz: boat.rotation.z,
            order: boat.rotation.order,
          };
          savedCamera = {
            x: G.camera.position.x,
            y: G.camera.position.y,
            z: G.camera.position.z,
            qx: G.camera.quaternion.x,
            qy: G.camera.quaternion.y,
            qz: G.camera.quaternion.z,
            qw: G.camera.quaternion.w,
            fov: G.camera.fov,
          };
          const post = G.render && G.render.post || {};
          savedPost = { fade: post.fade, saturation: post.saturation };

          state.x = boat.position.x;
          state.z = boat.position.z;
          state.heading = boat.rotation.y;
          state.speed = 0;
          state.pitch = 0.02;
          state.roll = 0;
          state.hudTime = 1;
          state.trailTime = 0;
          state.warn = 0;
          trail.length = 0;
          trail.push({ x: state.x, z: state.z });

          active = true;
          G.game.state = "sailing";
          G.game.menus.show("none");
          if (G.hud) {
            if (G.hud.show) G.hud.show(false);
            if (G.hud.setPrompt) G.hud.setPrompt(null);
          }
          if (G.weapon && G.weapon.setVisible) G.weapon.setVisible(false);
          if (G.player) {
            G.player.enabled = false;
            G.player.invulnerable = true;
          }
          try { G.audio && G.audio.setIntensity && G.audio.setIntensity(0.15); } catch {}
          try { G.audio && G.audio.setPaused && G.audio.setPaused(false); } catch {}
          try { G.input && G.input.setGameplay && G.input.setGameplay(true); } catch {}
          if (G.render && G.render.post) {
            G.render.post.fade = 0;
            G.render.post.saturation = 1;
            G.render.post.flash = 0;
          }
          ui.classList.add("on");
          ui.setAttribute("aria-hidden", "false");
          createWake();
          if (wake) wake.visible = false;
          tick(1 / 60, true);
          updateHud();
          drawMap();
          setToast("已离港 · 外海全域开放", 2.8);
          try { G.input && G.input.requestLock && G.input.requestLock(); } catch {}
        }

        function exitSail() {
          if (!active) return;
          active = false;
          clearTouch();
          ui.classList.remove("on");
          ui.setAttribute("aria-hidden", "true");
          if (wake) wake.visible = false;
          if (wakeMaterial) wakeMaterial.opacity = 0;
          if (dockPose && G.backdrop && G.backdrop.boat) {
            const boat = G.backdrop.boat;
            boat.position.set(dockPose.x, dockPose.y, dockPose.z);
            boat.rotation.order = dockPose.order;
            boat.rotation.y = dockPose.ry;
            boat.rotation.z = dockPose.rz;
          }
          if (savedCamera && G.camera) {
            G.camera.position.set(savedCamera.x, savedCamera.y, savedCamera.z);
            G.camera.quaternion.set(savedCamera.qx, savedCamera.qy, savedCamera.qz, savedCamera.qw);
            G.camera.fov = savedCamera.fov;
            G.camera.updateProjectionMatrix();
          }
          if (savedPost && G.render && G.render.post) {
            G.render.post.fade = savedPost.fade;
            G.render.post.saturation = savedPost.saturation;
          }
          try { G.input && G.input.setGameplay && G.input.setGameplay(false); } catch {}
          try { G.input && G.input.exitLock && G.input.exitLock(); } catch {}
          if (G.game) {
            G.game.state = "complete";
            G.game.menus.show("complete");
          }
          if (G.hud && G.hud.show) G.hud.show(false);
        }

        function clearTouch() {
          touch.forward = touch.back = touch.left = touch.right = touch.boost = 0;
          heldPointers.forEach(({ button }) => button && button.classList.remove("held"));
          heldPointers.clear();
        }

        function attach(Game) {
          G = Game;
          const gameUpdate = G.game.update;
          G.game.update = function (dt) {
            if (active && this.state === "sailing") {
              try { tick(dt); } catch (error) { console.error("[sail] update failed", error); }
              return false;
            }
            return gameUpdate.call(this, dt);
          };
          if (G.backdrop && typeof G.backdrop.update === "function") {
            const backdropUpdate = G.backdrop.update;
            G.backdrop.update = function (dt) {
              const result = backdropUpdate.apply(this, arguments);
              if (active) applyBoatPose();
              return result;
            };
          }
          window.__sail = {
            enter: enterSail,
            exit: exitSail,
            get active() { return active; },
            get speed() { return state.speed; },
            get position() { return { x: state.x, z: state.z }; },
            get heading() { return state.heading; },
          };
          ensureCompleteEntry();
        }

        document.addEventListener("click", (event) => {
          const target = event.target && event.target.closest && event.target.closest("[data-sail-enter], [data-sail='exit']");
          if (!target) return;
          event.preventDefault();
          event.stopPropagation();
          if (target.hasAttribute("data-sail-enter")) enterSail();
          else exitSail();
        }, true);

        document.addEventListener("pointerdown", (event) => {
          const button = event.target && event.target.closest && event.target.closest("[data-sail-hold]");
          if (!active || !button) return;
          event.preventDefault();
          event.stopPropagation();
          const action = button.getAttribute("data-sail-hold");
          touch[action] = 1;
          button.classList.add("held");
          heldPointers.set(event.pointerId, { action, button });
        }, true);

        function releasePointer(event) {
          const held = heldPointers.get(event.pointerId);
          if (!held) return;
          touch[held.action] = 0;
          held.button.classList.remove("held");
          heldPointers.delete(event.pointerId);
        }
        document.addEventListener("pointerup", releasePointer, true);
        document.addEventListener("pointercancel", releasePointer, true);

        window.addEventListener("keydown", (event) => {
          if (!active) return;
          if (event.code === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            exitSail();
          }
        }, true);

        const observer = new MutationObserver(ensureCompleteEntry);
        observer.observe(document.body, { childList: true, subtree: true });
        ensureCompleteEntry();

        const wait = setInterval(() => {
          const candidate = window.__G;
          if (!candidate || !candidate.game || !candidate.player || !candidate.backdrop || !candidate.backdrop.boat) return;
          clearInterval(wait);
          attach(candidate);
        }, 120);
      })();
