# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ["desktop.py"],
    pathex=[],
    binaries=[],
    datas=[("templates", "templates"), ("static", "static")],
    hiddenimports=[],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="Oud Notes",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch="arm64",
    codesign_identity=None,
    entitlements_file=None,
)
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name="Oud Notes",
)
app = BUNDLE(
    coll,
    name="Oud Notes.app",
    icon="assets/OudNotes.icns",
    bundle_identifier="com.hhabi9.oudnotes",
    info_plist={
        "CFBundleDisplayName": "Oud Notes",
        "CFBundleName": "Oud Notes",
        "CFBundleShortVersionString": "1.4.0",
        "CFBundleVersion": "6",
        "LSMinimumSystemVersion": "12.0",
        "NSHighResolutionCapable": True,
    },
)
