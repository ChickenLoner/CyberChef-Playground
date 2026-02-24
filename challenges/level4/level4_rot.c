#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <ctype.h>

// ROT47 implementation (covers all printable ASCII)
#define ROT_AMOUNT 47

void rot47_encrypt(unsigned char *data, size_t len) {
    for (size_t i = 0; i < len; i++) {
        if (data[i] >= '!' && data[i] <= '~') {
            data[i] = '!' + ((data[i] - '!' + ROT_AMOUNT) % 94);
        }
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
    
    // Encrypt with ROT47
    rot47_encrypt(buffer, file_size);
    
    FILE *output = fopen(argv[2], "wb");
    fwrite(buffer, 1, file_size, output);
    fclose(output);
    
    free(buffer);
    
    printf("File encrypted with ROT47 (rotation amount: %d)\n", ROT_AMOUNT);
    printf("Hint: ROT47 covers all printable ASCII characters (33-126)\n");
    return 0;
}