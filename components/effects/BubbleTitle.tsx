"use client";

import { useRef, useEffect, useCallback } from "react";
import * as THREE from "three";
import * as CANNON from "cannon-es";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import gsap from "gsap";

// Anime-style smoke poof particle system
class SmokePoofSystem {
  private scene: THREE.Scene;
  private particles: THREE.Mesh[] = [];
  private smokeTexture: THREE.Texture;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // Create a soft circular gradient texture for smoke
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d")!;

    // Radial gradient for soft smoke look
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
    gradient.addColorStop(0.3, "rgba(255, 255, 255, 0.8)");
    gradient.addColorStop(0.6, "rgba(240, 240, 255, 0.4)");
    gradient.addColorStop(1, "rgba(255, 255, 255, 0)");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);

    this.smokeTexture = new THREE.CanvasTexture(canvas);
  }

  // Create anime-style smoke poof at position
  createPoof(x: number, y: number, z: number, color: number = 0x888899) {
    const particleCount = 8; // Less dense
    const puffParticles: THREE.Mesh[] = [];

    for (let i = 0; i < particleCount; i++) {
      const geometry = new THREE.PlaneGeometry(1, 1);
      const material = new THREE.MeshBasicMaterial({
        map: this.smokeTexture,
        transparent: true,
        opacity: 0.4, // Much more subtle
        depthWrite: false,
        blending: THREE.NormalBlending, // Less bright blending
        color: color,
        side: THREE.DoubleSide,
      });

      const particle = new THREE.Mesh(geometry, material);
      particle.position.set(x, y, z);

      // Random initial rotation
      particle.rotation.z = Math.random() * Math.PI * 2;

      // Start small
      const startScale = 0.3 + Math.random() * 0.3;
      particle.scale.set(startScale, startScale, 1);

      this.scene.add(particle);
      puffParticles.push(particle);
      this.particles.push(particle);

      // Anime-style poof animation
      const angle = (i / particleCount) * Math.PI * 2 + Math.random() * 0.5;
      const distance = 1.5 + Math.random() * 2;
      const targetX = x + Math.cos(angle) * distance;
      const targetY = y + Math.sin(angle) * distance * 0.7 + Math.random() * 1.5; // Bias upward
      const targetZ = z + (Math.random() - 0.5) * 1;

      const duration = 0.4 + Math.random() * 0.3;
      const maxScale = 1.5 + Math.random() * 1.5;

      // Position animation - burst outward
      gsap.to(particle.position, {
        x: targetX,
        y: targetY,
        z: targetZ,
        duration: duration,
        ease: "power2.out",
      });

      // Scale animation - expand then shrink (anime poof style)
      gsap.to(particle.scale, {
        x: maxScale,
        y: maxScale,
        duration: duration * 0.4,
        ease: "power2.out",
        onComplete: () => {
          gsap.to(particle.scale, {
            x: maxScale * 1.2,
            y: maxScale * 1.2,
            duration: duration * 0.6,
            ease: "power1.in",
          });
        },
      });

      // Rotation animation
      gsap.to(particle.rotation, {
        z: particle.rotation.z + (Math.random() - 0.5) * 2,
        duration: duration,
        ease: "power1.out",
      });

      // Opacity fade out
      gsap.to(material, {
        opacity: 0,
        duration: duration,
        delay: duration * 0.2,
        ease: "power2.in",
        onComplete: () => {
          this.scene.remove(particle);
          geometry.dispose();
          material.dispose();
          const idx = this.particles.indexOf(particle);
          if (idx > -1) this.particles.splice(idx, 1);
        },
      });
    }

    // Add some speed lines for that anime dash effect
    this.createSpeedLines(x, y, z);
  }

  // Anime speed lines effect
  private createSpeedLines(x: number, y: number, z: number) {
    const lineCount = 5; // Fewer lines

    for (let i = 0; i < lineCount; i++) {
      const geometry = new THREE.PlaneGeometry(0.06, 0.6 + Math.random() * 0.4);
      const material = new THREE.MeshBasicMaterial({
        color: 0xaaaaaa,
        transparent: true,
        opacity: 0.4, // More subtle
        depthWrite: false,
        blending: THREE.NormalBlending,
        side: THREE.DoubleSide,
      });

      const line = new THREE.Mesh(geometry, material);

      // Position around the center
      const angle = (i / lineCount) * Math.PI * 2 + Math.random() * 0.3;
      const startDist = 0.3;
      line.position.set(
        x + Math.cos(angle) * startDist,
        y + Math.sin(angle) * startDist,
        z + 0.1
      );

      // Point outward
      line.rotation.z = angle - Math.PI / 2;

      this.scene.add(line);

      const endDist = 2 + Math.random() * 1.5;
      const duration = 0.25 + Math.random() * 0.15;

      // Burst outward
      gsap.to(line.position, {
        x: x + Math.cos(angle) * endDist,
        y: y + Math.sin(angle) * endDist,
        duration: duration,
        ease: "power2.out",
      });

      // Stretch then shrink
      gsap.to(line.scale, {
        y: 1.5,
        duration: duration * 0.3,
        ease: "power2.out",
        onComplete: () => {
          gsap.to(line.scale, {
            y: 0,
            x: 0,
            duration: duration * 0.7,
            ease: "power2.in",
          });
        },
      });

      // Fade out
      gsap.to(material, {
        opacity: 0,
        duration: duration,
        delay: 0.05,
        ease: "power1.in",
        onComplete: () => {
          this.scene.remove(line);
          geometry.dispose();
          material.dispose();
        },
      });
    }
  }

  // Create a big central poof (for the main disappear effect)
  createBigPoof(x: number, y: number, z: number) {
    const particleCount = 12; // Less dense

    for (let i = 0; i < particleCount; i++) {
      const geometry = new THREE.PlaneGeometry(1, 1);
      const material = new THREE.MeshBasicMaterial({
        map: this.smokeTexture,
        transparent: true,
        opacity: 0.35, // Much more subtle
        depthWrite: false,
        blending: THREE.NormalBlending,
        color: i % 3 === 0 ? 0x9999aa : 0x888899,
        side: THREE.DoubleSide,
      });

      const particle = new THREE.Mesh(geometry, material);
      particle.position.set(x, y, z);
      particle.rotation.z = Math.random() * Math.PI * 2;

      const startScale = 0.5;
      particle.scale.set(startScale, startScale, 1);

      this.scene.add(particle);

      const angle = Math.random() * Math.PI * 2;
      const distance = 2 + Math.random() * 4;
      const targetX = x + Math.cos(angle) * distance;
      const targetY = y + Math.sin(angle) * distance * 0.6 + 2 + Math.random() * 2;
      const targetZ = z + (Math.random() - 0.5) * 2;

      const duration = 0.6 + Math.random() * 0.4;
      const maxScale = 3 + Math.random() * 3;

      gsap.to(particle.position, {
        x: targetX,
        y: targetY,
        z: targetZ,
        duration: duration,
        ease: "power2.out",
      });

      gsap.to(particle.scale, {
        x: maxScale,
        y: maxScale,
        duration: duration * 0.5,
        ease: "power2.out",
        onComplete: () => {
          gsap.to(particle.scale, {
            x: maxScale * 1.3,
            y: maxScale * 1.3,
            duration: duration * 0.5,
            ease: "power1.out",
          });
        },
      });

      gsap.to(particle.rotation, {
        z: particle.rotation.z + (Math.random() - 0.5) * 3,
        duration: duration,
        ease: "power1.out",
      });

      gsap.to(material, {
        opacity: 0,
        duration: duration * 0.8,
        delay: duration * 0.2,
        ease: "power2.in",
        onComplete: () => {
          this.scene.remove(particle);
          geometry.dispose();
          material.dispose();
        },
      });
    }
  }

  dispose() {
    this.particles.forEach((p) => {
      this.scene.remove(p);
      p.geometry.dispose();
      (p.material as THREE.Material).dispose();
    });
    this.smokeTexture.dispose();
  }
}

interface BubbleTitleProps {
  text: string;
  onClickAway: () => void;
  isAnimatingOut: boolean;
}

export function BubbleTitle({ text, onClickAway, isAnimatingOut }: BubbleTitleProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseRef = useRef({ x: 0, y: 0, worldX: 0, worldY: 0 });
  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    world: CANNON.World;
    letterMeshes: THREE.Mesh[];
    letterBodies: CANNON.Body[];
    springs: CANNON.Spring[];
    initialPositions: CANNON.Vec3[];
    smokeSystem: SmokePoofSystem;
    animationId: number;
  } | null>(null);
  const hasAnimatedOutRef = useRef(false);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onClickAway();
  }, [onClickAway]);

  // Exit animation with smoke poof
  useEffect(() => {
    if (isAnimatingOut && sceneRef.current && !hasAnimatedOutRef.current) {
      hasAnimatedOutRef.current = true;
      const { letterMeshes, letterBodies, world, smokeSystem } = sceneRef.current;

      // Create a big central poof first
      if (letterMeshes.length > 0) {
        // Calculate center of all letters
        let centerX = 0, centerY = 0, centerZ = 0;
        letterMeshes.forEach(mesh => {
          centerX += mesh.position.x;
          centerY += mesh.position.y;
          centerZ += mesh.position.z;
        });
        centerX /= letterMeshes.length;
        centerY /= letterMeshes.length;
        centerZ /= letterMeshes.length;

        // Big central smoke explosion
        smokeSystem.createBigPoof(centerX, centerY, centerZ + 1);
      }

      // Disable physics
      letterBodies.forEach(body => {
        world.removeBody(body);
      });

      // Animate letters flying apart with individual smoke poofs
      letterMeshes.forEach((mesh, i) => {
        const startX = mesh.position.x;
        const startY = mesh.position.y;
        const startZ = mesh.position.z;

        // Create smoke poof at letter position (staggered)
        setTimeout(() => {
          smokeSystem.createPoof(startX, startY, startZ + 0.5);
        }, i * 30);

        // Quick scale down with slight delay
        gsap.to(mesh.scale, {
          x: 0,
          y: 0,
          z: 0,
          duration: 0.3,
          delay: i * 0.025,
          ease: "power2.in",
        });

        // Letters fly outward
        gsap.to(mesh.position, {
          x: startX + (Math.random() - 0.5) * 15,
          y: startY + Math.random() * 8 + 3,
          z: startZ - 5,
          duration: 0.4,
          delay: i * 0.02,
          ease: "power2.out",
        });

        // Tumble rotation
        gsap.to(mesh.rotation, {
          x: Math.random() * Math.PI,
          y: Math.random() * Math.PI,
          z: Math.random() * Math.PI,
          duration: 0.4,
          delay: i * 0.02,
        });
      });
    }
  }, [isAnimatingOut]);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = window.innerWidth;
    const height = window.innerHeight;

    // Three.js setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    camera.position.z = 30;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    // Lighting for neon glow effect
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
    directionalLight.position.set(5, 10, 15);
    scene.add(directionalLight);

    // Rim lights for that neon edge glow
    const rimLight1 = new THREE.DirectionalLight(0xaaccff, 0.8);
    rimLight1.position.set(-10, 5, -5);
    scene.add(rimLight1);

    const rimLight2 = new THREE.DirectionalLight(0xffaacc, 0.6);
    rimLight2.position.set(10, -5, -5);
    scene.add(rimLight2);

    const backLight = new THREE.DirectionalLight(0xccccff, 0.7);
    backLight.position.set(0, 0, -15);
    scene.add(backLight);

    // Cannon.js physics world
    const world = new CANNON.World();
    world.gravity.set(0, 0, 0); // No gravity - pure floating

    const defaultMaterial = new CANNON.Material("default");
    const contactMaterial = new CANNON.ContactMaterial(defaultMaterial, defaultMaterial, {
      friction: 0.3,
      restitution: 0.4, // Less bouncy
    });
    world.addContactMaterial(contactMaterial);
    world.defaultContactMaterial = contactMaterial;

    const letterMeshes: THREE.Mesh[] = [];
    const letterBodies: CANNON.Body[] = [];
    const springs: CANNON.Spring[] = [];
    const initialPositions: CANNON.Vec3[] = [];

    // Neon white glowing bubble material
    const bubbleMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 0.3,
      metalness: 0.0,
      roughness: 0.1,
      transmission: 0.2,
      thickness: 0.5,
      clearcoat: 1.0,
      clearcoatRoughness: 0.0,
      envMapIntensity: 1.2,
      side: THREE.DoubleSide,
    });

    // Create simple environment for reflections
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();

    // Create a simple gradient environment
    const envScene = new THREE.Scene();
    const envGeo = new THREE.SphereGeometry(50, 32, 32);
    const envMat = new THREE.MeshBasicMaterial({
      side: THREE.BackSide,
      color: 0x222233,
    });
    envScene.add(new THREE.Mesh(envGeo, envMat));

    // Add some colored lights to the env scene for reflections
    const envLight1 = new THREE.PointLight(0x4488ff, 100, 100);
    envLight1.position.set(20, 20, 20);
    envScene.add(envLight1);

    const envLight2 = new THREE.PointLight(0xff8844, 100, 100);
    envLight2.position.set(-20, -10, 20);
    envScene.add(envLight2);

    const envTexture = pmremGenerator.fromScene(envScene, 0.04).texture;
    bubbleMaterial.envMap = envTexture;

    // Create smoke poof system
    const smokeSystem = new SmokePoofSystem(scene);

    // Mouse tracking for forcefield effect
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouseRef.current.y = -(e.clientY / window.innerHeight) * 2 + 1;

      // Convert to world coordinates
      const vector = new THREE.Vector3(mouseRef.current.x, mouseRef.current.y, 0.5);
      vector.unproject(camera);
      const dir = vector.sub(camera.position).normalize();
      const distance = -camera.position.z / dir.z;
      const pos = camera.position.clone().add(dir.multiplyScalar(distance));
      mouseRef.current.worldX = pos.x;
      mouseRef.current.worldY = pos.y;
    };
    window.addEventListener("mousemove", handleMouseMove);

    // Load font and create letters
    const fontLoader = new FontLoader();

    fontLoader.load(
      "https://cdn.jsdelivr.net/npm/three@0.181.2/examples/fonts/helvetiker_bold.typeface.json",
      (font) => {
        const letters = text.split("");
        const letterSize = 2.2;
        const letterDepth = 0.8;
        const letterSpacing = 0.15;
        const spaceWidth = 1.2;

        // Calculate total width first
        let totalWidth = 0;
        letters.forEach((char) => {
          if (char === " ") {
            totalWidth += spaceWidth;
          } else {
            totalWidth += letterSize * 0.7 + letterSpacing;
          }
        });

        let xOffset = -totalWidth / 2;

        letters.forEach((char) => {
          if (char === " ") {
            xOffset += spaceWidth;
            return;
          }

          // Create 3D text geometry
          const geometry = new TextGeometry(char, {
            font: font,
            size: letterSize,
            depth: letterDepth,
            bevelEnabled: true,
            bevelThickness: 0.15,
            bevelSize: 0.1,
            bevelSegments: 5,
            curveSegments: 8,
          });

          geometry.computeBoundingBox();
          const bbox = geometry.boundingBox!;
          const charWidth = bbox.max.x - bbox.min.x;
          const charHeight = bbox.max.y - bbox.min.y;

          // Center the geometry
          geometry.translate(-charWidth / 2, -charHeight / 2, -letterDepth / 2);

          const mesh = new THREE.Mesh(geometry, bubbleMaterial.clone());
          mesh.position.set(xOffset + charWidth / 2, 0, 0);
          scene.add(mesh);

          // Create physics body with HIGH angular damping to prevent rotation
          const body = new CANNON.Body({
            mass: 1,
            shape: new CANNON.Box(new CANNON.Vec3(charWidth / 2 + 0.1, charHeight / 2 + 0.1, letterDepth / 2 + 0.1)),
            position: new CANNON.Vec3(xOffset + charWidth / 2, 0, 0),
            material: defaultMaterial,
            linearDamping: 0.8, // High damping for smooth movement
            angularDamping: 0.99, // Very high to prevent spinning
          });

          // Lock rotation on all axes to keep letters facing forward
          body.angularFactor.set(0, 0, 0.05); // Almost no rotation allowed

          world.addBody(body);

          letterMeshes.push(mesh);
          letterBodies.push(body);
          initialPositions.push(new CANNON.Vec3(xOffset + charWidth / 2, 0, 0));

          xOffset += charWidth + letterSpacing;
        });

        // Create spring constraints between adjacent letters (stiffer)
        for (let i = 0; i < letterBodies.length - 1; i++) {
          const bodyA = letterBodies[i];
          const bodyB = letterBodies[i + 1];
          const distance = bodyB.position.x - bodyA.position.x;

          const spring = new CANNON.Spring(bodyA, bodyB, {
            restLength: distance,
            stiffness: 80, // Stiffer to keep letters in line
            damping: 8,
          });
          springs.push(spring);
        }

        // Strong anchor springs to keep letters in their positions
        letterBodies.forEach((body, idx) => {
          const anchorBody = new CANNON.Body({
            mass: 0,
            position: initialPositions[idx].clone(),
          });
          world.addBody(anchorBody);

          // Strong spring to anchor - pulls back to original position
          const spring = new CANNON.Spring(body, anchorBody, {
            restLength: 0,
            stiffness: 15, // Strong pull back
            damping: 4,
          });
          springs.push(spring);
        });
      }
    );

    // Store refs
    sceneRef.current = {
      scene,
      camera,
      renderer,
      world,
      letterMeshes,
      letterBodies,
      springs,
      initialPositions,
      smokeSystem,
      animationId: 0,
    };

    // Animation loop
    let time = 0;
    const forceFieldRadius = 5; // How close mouse needs to be to affect letters
    const forceFieldStrength = 25; // How strong the repulsion is

    const animate = () => {
      sceneRef.current!.animationId = requestAnimationFrame(animate);
      time += 0.016;

      // Step physics
      world.step(1 / 60);

      // Apply spring forces
      springs.forEach((spring) => spring.applyForce());

      // Apply forces to each letter
      letterBodies.forEach((body, i) => {
        // Gentle floating force (subtle bobbing)
        const phase = i * 0.3;
        const floatForce = Math.sin(time * 1.2 + phase) * 0.3;
        body.applyForce(new CANNON.Vec3(0, floatForce, 0), body.position);

        // Mouse forcefield repulsion
        const dx = body.position.x - mouseRef.current.worldX;
        const dy = body.position.y - mouseRef.current.worldY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < forceFieldRadius && distance > 0.1) {
          // Repel letters away from mouse
          const force = (1 - distance / forceFieldRadius) * forceFieldStrength;
          const fx = (dx / distance) * force;
          const fy = (dy / distance) * force;
          body.applyForce(new CANNON.Vec3(fx, fy, 0), body.position);
        }

        // Keep letters from going too far on Z axis
        if (Math.abs(body.position.z) > 0.5) {
          body.applyForce(new CANNON.Vec3(0, 0, -body.position.z * 5), body.position);
        }

        // Reset rotation to face forward (lerp quaternion to identity)
        body.quaternion.x *= 0.9;
        body.quaternion.y *= 0.9;
        body.quaternion.z *= 0.9;
        body.quaternion.w = body.quaternion.w * 0.9 + 0.1;
        body.quaternion.normalize();
      });

      // Sync meshes with physics bodies
      letterBodies.forEach((body, i) => {
        if (letterMeshes[i]) {
          letterMeshes[i].position.set(body.position.x, body.position.y, body.position.z);
          letterMeshes[i].quaternion.set(
            body.quaternion.x,
            body.quaternion.y,
            body.quaternion.z,
            body.quaternion.w
          );
        }
      });

      // Render scene
      renderer.render(scene, camera);
    };
    animate();

    // Handle resize
    const handleResize = () => {
      const newWidth = window.innerWidth;
      const newHeight = window.innerHeight;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };
    window.addEventListener("resize", handleResize);

    // Cleanup
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      if (sceneRef.current) {
        cancelAnimationFrame(sceneRef.current.animationId);
      }
      renderer.dispose();
      pmremGenerator.dispose();
      smokeSystem.dispose();
      container.removeChild(renderer.domElement);

      // Dispose geometries and materials
      letterMeshes.forEach((mesh) => {
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      });
    };
  }, [text]);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-10 cursor-pointer"
      onClick={handleClick}
    />
  );
}
