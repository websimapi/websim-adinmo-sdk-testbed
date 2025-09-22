# Navigate to your extracted Unity package
cd /path/to/testttt/code_extraction/

# Show me the core AdInMo classes
cat AdinmoTexture.cs
cat AdinmoNativeWrapper.cs  
cat AdinmoStoreController.cs

# Or if the files are in reconstructed folder:
find . -name "*.cs" -path "*/Adinmo/*" -exec echo "=== {} ===" \; -exec cat {} \;

