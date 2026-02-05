#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <stdint.h>

// Base64 encoding table
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
    
    // Apply Base64 encoding 3 times (layers)
    unsigned char *current = buffer;
    size_t current_size = file_size;
    
    for (int layer = 0; layer < 3; layer++) {
        size_t encoded_size;
        char *encoded = base64_encode(current, current_size, &encoded_size);
        
        if (current != buffer) free(current);
        current = (unsigned char*)encoded;
        current_size = encoded_size;
        
        printf("Layer %d: Encoded to %zu bytes\n", layer + 1, encoded_size);
    }
    
    FILE *output = fopen(argv[2], "wb");
    fwrite(current, 1, current_size, output);
    fclose(output);
    
    free(current);
    free(buffer);
    
    printf("File encoded with 3 layers of Base64\n");
    return 0;
}
