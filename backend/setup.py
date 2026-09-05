from pathlib import Path

from pybind11.setup_helpers import Pybind11Extension, build_ext
from setuptools import setup

ROOT = Path(__file__).resolve().parent.parent
ENGINE = ROOT / "engine_cpp"

ext_modules = [
    Pybind11Extension(
        "prolife_engine",
        [str(ENGINE / "src" / "geometry.cpp")],
        include_dirs=[str(ENGINE / "include")],
        cxx_std=17,
    ),
]

setup(
    name="prolife_engine",
    version="0.1.0",
    ext_modules=ext_modules,
    cmdclass={"build_ext": build_ext},
)
