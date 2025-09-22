@echo off
REM Setup script for GPU-accelerated similarity calculation on Windows
REM This script installs the necessary dependencies for GPU face similarity

echo Setting up GPU-accelerated similarity calculation...

REM Check if CUDA is available
nvidia-smi >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ NVIDIA GPU detected
    nvidia-smi --query-gpu=name,memory.total --format=csv,noheader,nounits
) else (
    echo ⚠️  NVIDIA GPU not detected - will use CPU fallback
)

REM Check Python version
python --version
echo.

REM Install CuPy for GPU acceleration
echo Installing CuPy for GPU acceleration...

REM Try different CuPy versions based on CUDA version
nvidia-smi >nul 2>&1
if %errorlevel% equ 0 (
    echo Installing CuPy for CUDA...
    pip install cupy-cuda11x>=12.0.0
) else (
    echo Installing CuPy CPU version (no GPU detected)...
    pip install cupy-cpu>=12.0.0
)

REM Install PyTorch with CUDA support (alternative GPU backend)
echo Installing PyTorch with CUDA support...
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118

REM Install other GPU dependencies
echo Installing additional GPU dependencies...
pip install -r requirements-gpu.txt

REM Test GPU availability
echo Testing GPU availability...
python -c "try: import cupy as cp; print('✅ CuPy GPU test:'); test_array = cp.array([1, 2, 3]); result = cp.linalg.norm(test_array); print(f'   CuPy GPU calculation successful: {result}'); except Exception as e: print(f'❌ CuPy GPU test failed: {e}')"

python -c "try: import torch; print('✅ PyTorch GPU test:'); print(f'   PyTorch CUDA available: {torch.cuda.is_available()}'); except Exception as e: print(f'❌ PyTorch GPU test failed: {e}')"

echo.
echo GPU similarity setup completed!
echo Run 'python test_gpu_similarity.py' to test performance
pause



