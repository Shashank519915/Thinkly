"use client";
import * as THREE from 'three';
import { useRef, memo, useEffect, useState, ReactNode } from 'react';
import { Canvas, useFrame, useThree, ThreeElements, createPortal } from '@react-three/fiber';
import { MeshTransmissionMaterial, useFBO } from '@react-three/drei';
import { easing } from 'maath';

export default function FluidGlassBackground({ mode = 'lens', lensProps = {}, className }: any) {
    const [isMobile, setIsMobile] = useState(false);
    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    useEffect(() => {
        const originalWarn = console.warn;
        console.warn = (...args) => {
            if (typeof args[0] === 'string' && args[0].includes('THREE.Clock:')) return;
            originalWarn(...args);
        };
        return () => { console.warn = originalWarn; };
    }, []);

    return (
        <div className={`absolute inset-0 w-full h-full pointer-events-none z-[-1] m-0 p-0 overflow-hidden ${className || ''}`}>
            <div className="absolute inset-0 bg-black/40 z-[1] pointer-events-none" />
            
            {/* Background Film Grain Overlay - Base stacking so it's behind all UI layers */}
            <div className="fixed inset-0 pointer-events-none opacity-[0.045] z-[1] overflow-hidden">
                <div 
                    className="w-full h-full opacity-60 mix-blend-overlay" 
                    style={{ 
                        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
                    }}
                />
            </div>

            <Canvas 
                camera={{ position: [0, 0, 20], fov: 15 }} 
                gl={{ 
                    alpha: true, 
                    antialias: !isMobile, 
                    powerPreference: isMobile ? "low-power" : "high-performance" 
                }}
                dpr={isMobile ? [1, 1] : [1, 2]}
            >
                <ambientLight intensity={1.5} />
                <directionalLight position={[10, 10, 10]} intensity={1} />
                {mode === 'lens' && <Lens isMobile={isMobile} modeProps={lensProps} />}
            </Canvas>
        </div>
    );
}

function AppleGradients({ isMobile }: { isMobile?: boolean }) {
    const orb1 = useRef<THREE.Mesh>(null!);
    const orb2 = useRef<THREE.Mesh>(null!);
    const orb3 = useRef<THREE.Mesh>(null!);
    const orb4 = useRef<THREE.Mesh>(null!);
    
    const mat1 = useRef<THREE.MeshBasicMaterial>(null!);
    const mat2 = useRef<THREE.MeshBasicMaterial>(null!);
    const mat3 = useRef<THREE.MeshBasicMaterial>(null!);
    const mat4 = useRef<THREE.MeshBasicMaterial>(null!);

    const segments = isMobile ? 16 : 32;

    useFrame((state) => {
        // We use explicit strict Math.sin/cos binding so the objects NEVER physics-drift off the monitor!
        // This is a 100% infinite mathematical loop without any cuts or resets possible.
        const t = state.clock.elapsedTime * 0.3;

        if (orb1.current && mat1.current) {
            orb1.current.position.x = -1.5 + Math.sin(t * 0.4) * 1.0;
            orb1.current.position.y = 1.0 + Math.cos(t * 0.3) * 0.8;
            const scale = 1 + Math.sin(t * 0.6) * 0.2;
            orb1.current.scale.setScalar(scale);
            mat1.current.opacity = 0.5 + Math.sin(t * 0.5) * 0.4; 
        }

        if (orb2.current && mat2.current) {
            orb2.current.position.x = 1.5 + Math.cos(t * 0.5) * 1.0;
            orb2.current.position.y = -1.0 + Math.sin(t * 0.4) * 0.8;
            const scale = 1 + Math.cos(t * 0.5) * 0.2;
            orb2.current.scale.setScalar(scale);
            mat2.current.opacity = 0.5 + Math.cos(t * 0.6) * 0.4;
        }

        if (orb3.current && mat3.current) {
            orb3.current.position.x = Math.sin(t * 0.3) * 1.5;
            orb3.current.position.y = Math.cos(t * 0.2) * 1.5;
            const scale = 1 + Math.sin(t * 0.4) * 0.3;
            orb3.current.scale.setScalar(scale);
            mat3.current.opacity = 0.6 + Math.sin(t * 0.3) * 0.4;
        }

        if (orb4.current && mat4.current) {
            orb4.current.position.x = -1.0 + Math.cos(t * 0.6) * 1.5;
            orb4.current.position.y = -1.5 + Math.sin(t * 0.5) * 1.0;
            const scale = 1 + Math.cos(t * 0.7) * 0.2;
            orb4.current.scale.setScalar(scale);
            mat4.current.opacity = 0.5 + Math.cos(t * 0.4) * 0.4;
        }
    });

    return (
        <group position={[0, 0, -5]}>
            <mesh ref={orb1} position={[-1.5, 1, 0]} frustumCulled={false}>
                <sphereGeometry args={[3.0, segments, segments]} />
                <meshBasicMaterial ref={mat1} color="#FF2A6D" transparent depthWrite={false} />
            </mesh>
            <mesh ref={orb2} position={[1.5, -1, -1]} frustumCulled={false}>
                <sphereGeometry args={[3.5, segments, segments]} />
                <meshBasicMaterial ref={mat2} color="#05D5FF" transparent depthWrite={false} />
            </mesh>
            <mesh ref={orb3} position={[0, 0, -2]} frustumCulled={false}>
                <sphereGeometry args={[4.0, segments, segments]} />
                <meshBasicMaterial ref={mat3} color="#5511B0" transparent depthWrite={false} />
            </mesh>
            <mesh ref={orb4} position={[-1.5, -1, -3]} frustumCulled={false}>
                <sphereGeometry args={[2.5, segments, segments]} />
                <meshBasicMaterial ref={mat4} color="#FF9500" transparent depthWrite={false} />
            </mesh>

            <mesh position={[0, 0, -10]} frustumCulled={false}>
                <planeGeometry args={[150, 150]} />
                <meshBasicMaterial color="#050505" />
            </mesh>
        </group>
    );
}

const ModeWrapper = memo(function ModeWrapper({
    geometryNode,
    followPointer = true,
    isMobile = false,
    modeProps = {},
    ...props
}: { geometryNode: ReactNode, followPointer?: boolean, isMobile?: boolean, modeProps?: Record<string, unknown> } & ThreeElements['mesh']) {
    const ref = useRef<THREE.Mesh>(null!);
    const { size } = useThree();

    // Scale FBO resolution down for mobile
    const resolutionScale = isMobile ? 0.75 : 1.5;
    const buffer = useFBO(size.width * resolutionScale, size.height * resolutionScale, {
        samples: isMobile ? 0 : 4,
    });

    const [scene] = useState(() => {
        const s = new THREE.Scene();
        s.background = new THREE.Color("#050505");
        return s;
    });

    useFrame((state, delta) => {
        if (!ref.current) return;
        const { gl, pointer, camera, viewport } = state;
        const v = viewport.getCurrentViewport(camera, [0, 0, 15]);

        const maxLimitX = Math.max(0, (v.width / 2) - 2.5); // Lock securely inside screen center
        const maxLimitY = Math.max(0, (v.height / 2) - 2.5);
        let targetX = pointer.x * (v.width / 2);
        let targetY = pointer.y * (v.height / 2);

        targetX = Math.max(-maxLimitX, Math.min(maxLimitX, targetX));
        targetY = Math.max(-maxLimitY, Math.min(maxLimitY, targetY));

        const destX = followPointer ? targetX : 0;
        const destY = followPointer ? targetY : 0;

        easing.damp3(ref.current.position, [destX, destY, 15], 0.25, delta);

        ref.current.rotation.x += delta * 0.1;
        ref.current.rotation.y += delta * 0.15;

        // Render FBO layer mathematically scaled independently
        gl.setRenderTarget(buffer);
        gl.render(scene, camera);
        gl.setRenderTarget(null);
    });

    const { scale, ior, thickness, anisotropy, customBackside, ...extraMat } = modeProps as any;

    return (
        <>
            {/* ✅ SCALED PORTAL (Overscans the background so the FBO has data entirely outside the frame!) */}
            {createPortal(
                <group scale={1.5}>
                    <AppleGradients isMobile={isMobile} />
                </group>,
                scene
            )}

            <mesh ref={ref} scale={scale ?? 3} {...props}>
                {geometryNode}
                <MeshTransmissionMaterial
                    buffer={buffer.texture}
                    ior={ior ?? 1.15}
                    thickness={thickness ?? 5}
                    anisotropy={anisotropy ?? 0.05}
                    chromaticAberration={0.05}
                    clearcoat={1}
                    clearcoatRoughness={0.1}
                    roughness={0}
                    transmission={1}
                    backside={false}
                    {...extraMat}
                />
            </mesh>
        </>
    );
});

function Lens({ isMobile, modeProps, ...p }: { isMobile?: boolean, modeProps?: Record<string, unknown> } & ThreeElements['mesh']) {
    return (
        <ModeWrapper
            geometryNode={<cylinderGeometry args={[1, 1, 0.3, 64]} />}
            followPointer
            isMobile={isMobile}
            modeProps={modeProps}
            {...p}
        />
    );
}