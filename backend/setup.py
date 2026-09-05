#setup.py
from setuptools import setup
from pybind11.setup_helpers import Pybind11Extension, build_ext

ext_modules = [
    Pybind11Extension(
        "prolife_engine",
        ["../engine_cpp/src/geometry.cpp"],
        include_dirs=["../engine_cpp/include"],
    ),
]

setup(
    name="prolife_engine",
    version="0.1.0",
    ext_modules=ext_modules,
    cmdclass={"build_ext": build_ext},
)