#include <stdio.h>
#include <string.h>
#include <stdlib.h>

// Simplified encryption for demo (Caesar cipher with key)
// In real scenario, this would be AES. Kept simple for compilation without OpenSSL
#define ENCRYPT_KEY 137

void simple_encrypt(unsigned char *data, size_t len, unsigned char key) {
    for (size_t i = 0; i < len; i++) {
        data[i] = (data[i] + key) % 256;
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
    
    // Encrypt with simple substitution
    simple_encrypt(buffer, file_size, ENCRYPT_KEY);
    
    FILE *output = fopen(argv[2], "wb");
    fwrite(buffer, 1, file_size, output);
    fclose(output);
    
    free(buffer);
    
    printf("File encrypted successfully\n");
    printf("Key: %d (0x%02X)\n", ENCRYPT_KEY, ENCRYPT_KEY);
    printf("Hint: This is a simple substitution cipher. Use 'From Decimal' and 'ADD' operations.\n");
    return 0;
}