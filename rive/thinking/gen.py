#!/usr/bin/env python3
"""Generates scene.rml for the Brandbeat "Thinking" mark. Run: python3 gen.py"""
import math, pathlib

WHITE, BLUE = "FFFFFFFF", "FF699FFF"
W = 12  # bar thickness (3px at 24px render)
C = 48  # artboard centre
THINK_FRAMES, DONE_FRAMES = 54, 27  # 0.9s loop, 0.45s morph @60fps

# Thinking: bar centre x, colour, height keyframes (frame, height); first == last for a seamless loop.
BARS = [
    (19.5, WHITE, [(0, 30), (11, 60), (24, 22), (38, 52), (54, 30)]),
    (38.5, WHITE, [(0, 58), (14, 24), (27, 56), (41, 20), (54, 58)]),
    (57.5, WHITE, [(0, 22), (15, 48), (29, 64), (44, 18), (54, 22)]),
    (76.5, BLUE,  [(0, 44), (9, 18), (21, 40), (34, 58), (48, 24), (54, 44)]),
]

# Checkmark A(24,48) -> B(40,64) -> C(72,32); each bar becomes one capsule segment of it.
def seg(p, q):
    (x1, y1), (x2, y2) = p, q
    L = math.hypot(x2 - x1, y2 - y1)
    # bar's long axis is +y; rotate so it lies along p->q
    rot = math.atan2(-(x2 - x1), (y2 - y1))
    return ((x1 + x2) / 2, (y1 + y2) / 2, round(rot, 5), round(L + W, 3))

A, B, Cc = (24, 48), (40, 64), (72, 32)
M1, M2 = (32, 56), (56, 48)
CHECK = [seg(A, M1), seg(M1, B), seg(B, M2), seg(M2, Cc)]

ATTACK = (0.22, 0.9, 0.36, 1)   # quick rise, soft landing
GRAVITY = (0.5, 0, 0.62, 1)     # heavier fall
MOVE = (0.55, 0, 0.2, 1)        # accelerate out of collapse, decelerate into the check
OUT = (0, 0, 0.58, 1)
INOUT = (0.42, 0, 0.58, 1)
GROW = (0.3, 0, 0.1, 1)         # snappy stroke draw

def kf(value, frame, curve=None, kind="Double"):
    v = f'value="{value}" frame="{frame}"'
    if curve is None:
        return f'<KeyFrame{kind} {v} interpolationType="linear"/>'
    x1, y1, x2, y2 = curve
    return (f'<KeyFrame{kind} {v} interpolationType="cubic">'
            f'<CubicEaseInterpolator x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}"/></KeyFrame{kind}>')

def prop(name, frames):
    return f'<KeyedProperty property="{name}">' + "".join(frames) + "</KeyedProperty>"

def keyed(oid, *props):
    return f'<KeyedObject objectId="{oid}">' + "".join(props) + "</KeyedObject>"

ids = lambda i: (f"0:{100 + i * 10}", f"0:{101 + i * 10}", f"0:{102 + i * 10}")  # shape, rect, colour

shapes, think, done = [], [], []
for i, (x, col, hs) in enumerate(BARS):
    sid, rid, cid = ids(i)
    shapes.append(
        f'<Shape x="{x}" y="{C}" name="Bar{i + 1}" id="{sid}">'
        f'<Rectangle width="{W}" height="{hs[0][1]}" cornerRadiusTL="{W / 2}" name="Pill" id="{rid}"/>'
        f'<Fill name="Fill"><SolidColor colorValue="{col}" name="Color" id="{cid}"/></Fill></Shape>')
    frames = []
    for j, (f, h) in enumerate(hs):
        nxt = hs[j + 1][1] if j + 1 < len(hs) else None
        frames.append(kf(h, f, None if nxt is None else (ATTACK if nxt > h else GRAVITY)))
    think.append(keyed(rid, prop("height", frames)))

    tx, ty, rot, L = CHECK[i]
    stagger = i  # one-frame cascade left->right
    s, e = 3 + stagger, 13 + stagger   # dots travel + rotate (rotation invisible on a dot)
    g0, g1 = 11 + stagger, 21 + stagger  # then extend into the check stroke
    done.append(keyed(sid,
        prop("x", [kf(x, 0, MOVE), kf(x, s, MOVE), kf(tx, e)]),
        prop("y", [kf(C, 0, MOVE), kf(C, s, MOVE), kf(ty, e)]),
        prop("rotation", [kf(0, 0, MOVE), kf(0, s, MOVE), kf(rot, e)])))
    done.append(keyed(rid, prop("height", [kf(W, 0, OUT), kf(W, g0, GROW), kf(L, g1)])))
    done.append(keyed(cid, prop("colorValue", [kf(col, 0, INOUT, "Color"), kf(col, s, INOUT, "Color"), kf(BLUE, e, None, "Color")])))

# whole-mark squash then overshoot
done.append(keyed("0:90", *[prop(p, [kf(1, 0, INOUT), kf(0.86, 8, OUT), kf(1.12, 21, INOUT), kf(1, DONE_FRAMES)])
                             for p in ("scaleX", "scaleY")]))

rml = f'''<Rive version="1" kind="fragment">
    <Artboard defaultStateMachineId="0:7" styleId="0:5" width="96" height="96" name="Thinking" id="0:2">
        <LayoutComponentStyle name="Artboard Style" id="0:5"/>
        <Node x="{C}" y="{C}" name="Mark" id="0:90">
            <Node x="-{C}" y="-{C}" name="Bars" id="0:91">
                {"".join(shapes)}
            </Node>
        </Node>
        <StateMachine name="Main" id="0:7">
            <StateMachineBool name="done" id="0:40"/>
            <StateMachineLayer name="Layer 1" id="0:8">
                <AnyState x="200" y="-120"/>
                <ExitState x="560" y="-120"/>
                <EntryState x="0" y="0"><StateTransition stateToId="0:12"/></EntryState>
                <AnimationState x="200" y="0" animationId="0:20" id="0:12">
                    <StateTransition stateToId="0:13" duration="140" interpolationType="cubic">
                        <CubicEaseInterpolator x1="0.4" y1="0" x2="0.2" y2="1"/>
                        <TransitionBoolCondition inputId="0:40" opValue="equal"/>
                    </StateTransition>
                </AnimationState>
                <AnimationState x="400" y="0" animationId="0:21" reset="true" id="0:13">
                    <StateTransition stateToId="0:12" duration="260" interpolationType="cubic">
                        <CubicEaseInterpolator x1="0.4" y1="0" x2="0.2" y2="1"/>
                        <TransitionBoolCondition inputId="0:40" opValue="notEqual"/>
                    </StateTransition>
                </AnimationState>
            </StateMachineLayer>
        </StateMachine>
        <LinearAnimation loopValue="loop" duration="{THINK_FRAMES}" name="Thinking" id="0:20">{"".join(think)}</LinearAnimation>
        <LinearAnimation loopValue="oneShot" duration="{DONE_FRAMES}" name="Done" id="0:21">{"".join(done)}</LinearAnimation>
    </Artboard>
</Rive>
'''
out = pathlib.Path(__file__).with_name("scene.rml")
out.write_text(rml)
print("wrote", out)
