#include <stdio.h>
#include <string.h>
#include <stdlib.h>

// XOR key - single byte
#define XOR_KEY 0x42

void xor_encrypt(unsigned char *data, size_t len) {
    for (size_t i = 0; i < len; i++) {
        data[i] ^= XOR_KEY;
    }
}

int main(int argc, char *argv[]) {
    if (argc != 3) {
        printf("Usage: %s <input_file> <output_file>\n", argv[0]);
        return 1;
    }
    
    FILE *input = fopen(argv[1], "rb");
    if (!input) {
        perror("Error opening input file");
        return 1;
    }
    
    fseek(input, 0, SEEK_END);
    long file_size = ftell(input);
    fseek(input, 0, SEEK_SET);
    
    unsigned char *buffer = malloc(file_size);
    fread(buffer, 1, file_size, input);
    fclose(input);
    
    // Encrypt with XOR
    xor_encrypt(buffer, file_size);
    
    FILE *output = fopen(argv[2], "wb");
    fwrite(buffer, 1, file_size, output);
    fclose(output);
    
    free(buffer);
    
    printf("File encrypted successfully with XOR key: 0x%02X\n", XOR_KEY);
    return 0;
}
