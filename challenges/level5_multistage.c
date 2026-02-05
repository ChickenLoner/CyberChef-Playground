#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <stdint.h>

// Multi-stage encryption parameters
#define XOR_KEY 0x5A
#define CAESAR_KEY 73

// Base64 encoding
static const char base64_table[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

char* base64_encode(const unsigned char *data, size_t input_length, size_t *output_length) {
    *output_length = 4 * ((input_length + 2) / 3);
    char *encoded_data = malloc(*output_length + 1);
    if (!encoded_data) return NULL;
    
    for (size_t i = 0, j = 0; i < input_length;) {
        uint32_t octet_a = i < input_length ? data[i++] : 0;
        uint32_t octet_b = i < input_length ? data[i++] : 0;
        uint32_t octet_c = i < input_length ? data[i++] : 0;
        uint32_t triple = (octet_a << 16) + (octet_b << 8) + octet_c;
        
        encoded_data[j++] = base64_table[(triple >> 18) & 0x3F];
        encoded_data[j++] = base64_table[(triple >> 12) & 0x3F];
        encoded_data[j++] = base64_table[(triple >> 6) & 0x3F];
        encoded_data[j++] = base64_table[triple & 0x3F];
    }
    
    for (size_t i = 0; i < (3 - input_length % 3) % 3; i++) {
        encoded_data[*output_length - 1 - i] = '=';
    }
    
    encoded_data[*output_length] = '\0';
    return encoded_data;
}

void xor_encrypt(unsigned char *data, size_t len, unsigned char key) {
    for (size_t i = 0; i < len; i++) {
        data[i] ^= key;
    }
}

void caesar_encrypt(unsigned char *data, size_t len, unsigned char key) {
    for (size_t i = 0; i < len; i++) {
        data[i] = (data[i] + key) % 256;
    }
}

int main(int argc, char *argv[]) {
    if (argc != 3) {
        printf("Usage: %s <input_file> <output_file>\n", argv[0]);
        printf("\nThis is a RANSOMWARE-LIKE multi-stage encryption:\n");
        printf("Stage 1: XOR with key 0x%02X\n", XOR_KEY);
        printf("Stage 2: Base64 encoding\n");
        printf("Stage 3: Caesar cipher with key %d\n", CAESAR_KEY);
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
    
    // Stage 1: XOR encryption
    printf("[Stage 1] Applying XOR with key: 0x%02X\n", XOR_KEY);
    xor_encrypt(buffer, file_size, XOR_KEY);
    
    // Stage 2: Base64 encoding
    printf("[Stage 2] Applying Base64 encoding\n");
    size_t base64_len;
    char *base64_data = base64_encode(buffer, file_size, &base64_len);
    free(buffer);
    
    // Stage 3: Caesar cipher
    printf("[Stage 3] Applying Caesar cipher with key: %d\n", CAESAR_KEY);
    caesar_encrypt((unsigned char*)base64_data, base64_len, CAESAR_KEY);
    
    FILE *output = fopen(argv[2], "wb");
    fwrite(base64_data, 1, base64_len, output);
    fclose(output);
    
    free(base64_data);
    
    printf("\n=== ENCRYPTION COMPLETE ===\n");
    printf("Your file has been encrypted with multi-stage encryption!\n");
    printf("\nDecryption parameters:\n");
    printf("XOR Key: 0x%02X (%d)\n", XOR_KEY, XOR_KEY);
    printf("Caesar Key: %d (0x%02X)\n", CAESAR_KEY, CAESAR_KEY);
    printf("\nDecryption order (reverse): Caesar Subtract -> Base64 Decode -> XOR\n");
    printf("Good luck, CTF player!\n");
    
    return 0;
}