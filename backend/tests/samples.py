"""A sample template in the older compact format (fractions + box), used by the renderer tests."""
BG = {"type": "image", "src": "{{background}}", "box": [0, 0, 1, 1], "z": 0}
AUDIO = {"type": "audio", "src": "{{audio}}"}

EXAMPLE = {
    "scenes": [
        {"duration": 3, "background": "#1A0B2E", "elements": [
            {"type": "image", "src": "{{photo_1}}", "box": [0.08, 0.1, 0.84, 0.5], "fit": "cover", "zoom": 2, "z": 1},
            {"type": "text", "text": "Happy Birthday, {{name}}!", "box": [0.05, 0.66, 0.9, 0.16], "size": 0.075, "font": "Playfair Display", "color": "#FFE8A3"},
        ]},
        {"duration": 3, "transition": "fadewhite", "elements": [
            {"type": "image", "src": "{{photo_2}}", "box": [0.08, 0.1, 0.84, 0.5], "fit": "cover", "zoom": 2, "z": 1},
            {"type": "text", "text": "{{fun_fact}}", "box": [0.05, 0.66, 0.9, 0.16], "size": 0.05, "color": "#FFFFFF"},
        ]},
        {"duration": 3, "transition": "fadewhite", "elements": [
            {"type": "image", "src": "{{photo_3}}", "box": [0.08, 0.1, 0.84, 0.5], "fit": "cover", "zoom": 2, "z": 1},
            {"type": "text", "text": "With love, {{sender}}", "box": [0.05, 0.66, 0.9, 0.16], "size": 0.06, "font": "Playfair Display"},
        ]},
    ],
    "elements": [BG, AUDIO],
}
