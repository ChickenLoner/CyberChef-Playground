#!/usr/bin/env python3
import os
import subprocess
import sys

def compile_c_file(source, output, needs_ssl=False):
    """Compile C source file"""
    cmd = ['gcc', source, '-o', output]
    if needs_ssl:
        cmd.extend(['-lcrypto', '-lssl'])
    
    print(f"Compiling {source}...")
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    if result.returncode != 0:
        print(f"Error compiling {source}:")
        print(result.stderr)
        return False
    
    # Strip binary to make reverse engineering more challenging
    subprocess.run(['strip', output], capture_output=True)
    print(f"✓ Compiled and stripped: {output}")
    return True

def create_test_file():
    """Create the test.txt file with 'test' content"""
    with open('test.txt', 'w') as f:
        f.write('test')
    print("✓ Created test.txt")

def encrypt_file(binary, input_file, output_file):
    """Run encryption binary on test file"""
    print(f"Encrypting with {binary}...")
    result = subprocess.run([f'./{binary}', input_file, output_file], 
                          capture_output=True, text=True)
    
    if result.returncode != 0:
        print(f"Error running {binary}:")
        print(result.stderr)
        return False
    
    print(result.stdout)
    print(f"✓ Created encrypted file: {output_file}")
    return True

def main():
    # Get the script's directory and change to challenges subdirectory
    script_dir = os.path.dirname(os.path.abspath(__file__))
    challenges_dir = os.path.join(script_dir, 'challenges')
    
    # Check if challenges directory exists
    if not os.path.exists(challenges_dir):
        print(f"Error: challenges directory not found at {challenges_dir}")
        print("Creating challenges directory...")
        os.makedirs(challenges_dir)
    
    # Change to challenges directory
    os.chdir(challenges_dir)
    print(f"Working in: {os.getcwd()}")
    print()
    
    # Check if source files exist
    required_sources = ['level1_xor.c', 'level2_base64.c', 'level3_simple.c', 
                       'level4_rot.c', 'level5_multistage.c']
    missing_sources = [f for f in required_sources if not os.path.exists(f)]
    
    if missing_sources:
        print("ERROR: Missing required source files:")
        for src in missing_sources:
            print(f"  - {src}")
        print("\nPlease add the missing C source files to the challenges/ directory")
        sys.exit(1)
    
    # Create test file
    create_test_file()
    
    # Level 1: XOR
    if compile_c_file('level1_xor.c', 'level1_xor'):
        encrypt_file('level1_xor', 'test.txt', 'level1_encrypted.bin')
    
    # Level 2: Base64
    if compile_c_file('level2_base64.c', 'level2_base64'):
        encrypt_file('level2_base64', 'test.txt', 'level2_encrypted.bin')
    
    # Level 3: Simple cipher (no OpenSSL)
    if compile_c_file('level3_simple.c', 'level3_aes'):
        encrypt_file('level3_aes', 'test.txt', 'level3_encrypted.bin')
    
    # Level 4: ROT
    if compile_c_file('level4_rot.c', 'level4_rot'):
        encrypt_file('level4_rot', 'test.txt', 'level4_encrypted.bin')
    
    # Level 5: Multi-stage (no OpenSSL)
    if compile_c_file('level5_multistage.c', 'level5_boss'):
        encrypt_file('level5_boss', 'test.txt', 'level5_encrypted.bin')
    
    # Clean up test.txt
    os.remove('test.txt')
    
    print("\n" + "="*50)
    print("All challenges compiled and encrypted successfully!")
    print("="*50)
    
    # List all files
    print("\nGenerated files:")
    for file in sorted(os.listdir('.')):
        if not file.endswith('.c'):
            size = os.path.getsize(file)
            print(f"  {file:30s} ({size:6d} bytes)")

if __name__ == '__main__':
    main()