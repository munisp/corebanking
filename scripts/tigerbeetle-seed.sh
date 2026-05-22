#!/usr/bin/env bash
# 54Bank TigerBeetle Seed Data
# Creates ledger accounts and sample transfers
# Usage: TB_ADDRESS=localhost:3001 bash scripts/tigerbeetle-seed.sh

TB_CLI="${TB_CLI:-tigerbeetle}"
TB_ADDR="${TB_ADDRESS:-127.0.0.1:3001}"
CLUSTER_ID="${TB_CLUSTER_ID:-0}"

echo '=== Creating TigerBeetle Ledger Accounts ==='

echo "create_accounts id=1001 ledger=1 code=8516 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1002 ledger=1 code=4657 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1003 ledger=1 code=2282 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1004 ledger=1 code=9012 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1005 ledger=1 code=9183 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1006 ledger=1 code=2652 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1007 ledger=1 code=9970 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1008 ledger=1 code=4521 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1009 ledger=1 code=6 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1010 ledger=1 code=3691 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1011 ledger=1 code=4847 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1012 ledger=1 code=128 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1013 ledger=1 code=7511 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1014 ledger=1 code=8538 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1015 ledger=1 code=3527 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1016 ledger=1 code=5994 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1017 ledger=1 code=5254 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1018 ledger=1 code=1406 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1019 ledger=1 code=1939 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1020 ledger=1 code=4134 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1021 ledger=1 code=2646 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1022 ledger=1 code=6075 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1023 ledger=1 code=7749 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1024 ledger=1 code=5852 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1025 ledger=1 code=1690 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1026 ledger=1 code=1025 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1027 ledger=1 code=1008 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1028 ledger=1 code=4815 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1029 ledger=1 code=5116 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1030 ledger=1 code=1277 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1031 ledger=1 code=2405 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1032 ledger=1 code=8898 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1033 ledger=1 code=7805 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1034 ledger=1 code=5238 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1035 ledger=1 code=6653 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1036 ledger=1 code=362 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1037 ledger=1 code=4962 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1038 ledger=1 code=1711 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1039 ledger=1 code=7979 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1040 ledger=1 code=282 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1041 ledger=1 code=4276 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1042 ledger=1 code=7932 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1043 ledger=1 code=5954 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1044 ledger=1 code=4497 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1045 ledger=1 code=1012 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1046 ledger=1 code=4183 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1047 ledger=1 code=2922 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1048 ledger=1 code=3153 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1049 ledger=1 code=1501 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1050 ledger=1 code=196 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1051 ledger=1 code=1906 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1052 ledger=1 code=4977 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1053 ledger=1 code=486 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1054 ledger=1 code=6323 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1055 ledger=1 code=7651 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1056 ledger=1 code=7616 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1057 ledger=1 code=4544 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1058 ledger=1 code=8863 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1059 ledger=1 code=6535 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1060 ledger=1 code=8120 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1061 ledger=1 code=7647 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1062 ledger=1 code=8192 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1063 ledger=1 code=4899 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1064 ledger=1 code=6530 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1065 ledger=1 code=3705 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1066 ledger=1 code=8191 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1067 ledger=1 code=7761 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1068 ledger=1 code=390 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1069 ledger=1 code=7625 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1070 ledger=1 code=9122 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1071 ledger=1 code=3336 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1072 ledger=1 code=5174 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1073 ledger=1 code=7531 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1074 ledger=1 code=4766 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1075 ledger=1 code=6385 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1076 ledger=1 code=8206 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1077 ledger=1 code=6025 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1078 ledger=1 code=4609 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1079 ledger=1 code=8458 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1080 ledger=1 code=9747 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1081 ledger=1 code=38 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1082 ledger=1 code=3607 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1083 ledger=1 code=6813 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1084 ledger=1 code=2407 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1085 ledger=1 code=9342 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1086 ledger=1 code=3603 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1087 ledger=1 code=2783 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1088 ledger=1 code=8052 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1089 ledger=1 code=3584 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1090 ledger=1 code=9928 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1091 ledger=1 code=5313 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1092 ledger=1 code=9156 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1093 ledger=1 code=1787 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1094 ledger=1 code=6226 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1095 ledger=1 code=576 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1096 ledger=1 code=8579 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1097 ledger=1 code=5380 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1098 ledger=1 code=3134 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1099 ledger=1 code=4982 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1100 ledger=1 code=1532 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1101 ledger=1 code=6657 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1102 ledger=1 code=2988 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1103 ledger=1 code=524 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1104 ledger=1 code=424 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1105 ledger=1 code=9858 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1106 ledger=1 code=6182 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1107 ledger=1 code=194 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1108 ledger=1 code=4873 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1109 ledger=1 code=7572 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1110 ledger=1 code=6317 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1111 ledger=1 code=7691 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1112 ledger=1 code=9169 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1113 ledger=1 code=8352 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1114 ledger=1 code=3806 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1115 ledger=1 code=3149 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1116 ledger=1 code=7692 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1117 ledger=1 code=5614 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1118 ledger=1 code=4867 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1119 ledger=1 code=9330 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1120 ledger=1 code=7563 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1121 ledger=1 code=9308 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1122 ledger=1 code=6455 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1123 ledger=1 code=8303 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1124 ledger=1 code=5472 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1125 ledger=1 code=6709 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1126 ledger=1 code=7242 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1127 ledger=1 code=3596 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1128 ledger=1 code=4787 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1129 ledger=1 code=6384 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1130 ledger=1 code=2732 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1131 ledger=1 code=7603 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1132 ledger=1 code=2407 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1133 ledger=1 code=9552 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1134 ledger=1 code=309 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1135 ledger=1 code=6840 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1136 ledger=1 code=4489 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1137 ledger=1 code=181 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1138 ledger=1 code=660 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1139 ledger=1 code=3655 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1140 ledger=1 code=9928 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1141 ledger=1 code=6297 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1142 ledger=1 code=7647 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1143 ledger=1 code=5771 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1144 ledger=1 code=2564 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1145 ledger=1 code=6192 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1146 ledger=1 code=9095 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1147 ledger=1 code=7868 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1148 ledger=1 code=6141 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1149 ledger=1 code=7305 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1150 ledger=1 code=2834 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1151 ledger=1 code=8938 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1152 ledger=1 code=8580 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1153 ledger=1 code=8925 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1154 ledger=1 code=8371 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1155 ledger=1 code=8872 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1156 ledger=1 code=6431 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1157 ledger=1 code=8860 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1158 ledger=1 code=8705 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1159 ledger=1 code=6228 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1160 ledger=1 code=5467 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1161 ledger=1 code=558 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1162 ledger=1 code=3630 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1163 ledger=1 code=4310 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1164 ledger=1 code=8813 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1165 ledger=1 code=4389 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1166 ledger=1 code=6002 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1167 ledger=1 code=1529 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1168 ledger=1 code=7107 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1169 ledger=1 code=2751 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1170 ledger=1 code=3089 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1171 ledger=1 code=1277 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1172 ledger=1 code=7339 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1173 ledger=1 code=8094 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1174 ledger=1 code=5182 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1175 ledger=1 code=8290 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1176 ledger=1 code=9799 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1177 ledger=1 code=6185 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1178 ledger=1 code=299 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1179 ledger=1 code=9904 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1180 ledger=1 code=5148 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1181 ledger=1 code=5902 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1182 ledger=1 code=5444 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1183 ledger=1 code=8200 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1184 ledger=1 code=4199 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1185 ledger=1 code=2327 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1186 ledger=1 code=3863 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1187 ledger=1 code=338 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1188 ledger=1 code=2657 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1189 ledger=1 code=6794 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1190 ledger=1 code=4668 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1191 ledger=1 code=5553 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1192 ledger=1 code=3196 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1193 ledger=1 code=9235 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1194 ledger=1 code=5664 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1195 ledger=1 code=7357 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1196 ledger=1 code=757 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1197 ledger=1 code=9953 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1198 ledger=1 code=9318 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1199 ledger=1 code=5609 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_accounts id=1200 ledger=1 code=5835 flags=0" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR

echo '=== Creating TigerBeetle Transfers ==='

echo "create_transfers id=10000 debit_account_id=1178 credit_account_id=1007 amount=489535613 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10001 debit_account_id=1145 credit_account_id=1304 amount=25520394 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10002 debit_account_id=1109 credit_account_id=1156 amount=566505684 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10003 debit_account_id=1349 credit_account_id=1152 amount=987237317 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10004 debit_account_id=1288 credit_account_id=1230 amount=183758857 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10005 debit_account_id=1114 credit_account_id=1043 amount=690680138 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10006 debit_account_id=1188 credit_account_id=1078 amount=586183532 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10007 debit_account_id=1273 credit_account_id=1149 amount=540988769 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10008 debit_account_id=1329 credit_account_id=1154 amount=985662235 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10009 debit_account_id=1308 credit_account_id=1186 amount=143275027 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10010 debit_account_id=1272 credit_account_id=1179 amount=537496336 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10011 debit_account_id=1361 credit_account_id=1007 amount=339291688 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10012 debit_account_id=1175 credit_account_id=1074 amount=501797321 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10013 debit_account_id=1301 credit_account_id=1299 amount=196339219 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10014 debit_account_id=1228 credit_account_id=1329 amount=409379065 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10015 debit_account_id=1201 credit_account_id=1269 amount=598112422 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10016 debit_account_id=1066 credit_account_id=1075 amount=644866210 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10017 debit_account_id=1024 credit_account_id=1105 amount=638312218 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10018 debit_account_id=1012 credit_account_id=1048 amount=226117161 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10019 debit_account_id=1136 credit_account_id=1152 amount=413020422 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10020 debit_account_id=1077 credit_account_id=1196 amount=227925929 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10021 debit_account_id=1197 credit_account_id=1118 amount=306839960 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10022 debit_account_id=1142 credit_account_id=1061 amount=705781801 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10023 debit_account_id=1285 credit_account_id=1268 amount=336598470 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10024 debit_account_id=1358 credit_account_id=1118 amount=4066310 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10025 debit_account_id=1317 credit_account_id=1299 amount=219500187 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10026 debit_account_id=1013 credit_account_id=1258 amount=334361437 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10027 debit_account_id=1169 credit_account_id=1109 amount=658810554 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10028 debit_account_id=1102 credit_account_id=1365 amount=950234966 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10029 debit_account_id=1257 credit_account_id=1326 amount=243124363 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10030 debit_account_id=1220 credit_account_id=1278 amount=131659410 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10031 debit_account_id=1070 credit_account_id=1374 amount=594505488 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10032 debit_account_id=1099 credit_account_id=1114 amount=114487958 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10033 debit_account_id=1320 credit_account_id=1277 amount=15502807 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10034 debit_account_id=1027 credit_account_id=1049 amount=459265820 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10035 debit_account_id=1017 credit_account_id=1293 amount=182876673 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10036 debit_account_id=1005 credit_account_id=1031 amount=551652809 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10037 debit_account_id=1185 credit_account_id=1298 amount=601494730 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10038 debit_account_id=1162 credit_account_id=1237 amount=132232412 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10039 debit_account_id=1168 credit_account_id=1359 amount=99172882 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10040 debit_account_id=1292 credit_account_id=1154 amount=569615492 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10041 debit_account_id=1088 credit_account_id=1290 amount=343689701 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10042 debit_account_id=1176 credit_account_id=1172 amount=724040455 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10043 debit_account_id=1163 credit_account_id=1048 amount=296647194 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10044 debit_account_id=1320 credit_account_id=1160 amount=277998142 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10045 debit_account_id=1192 credit_account_id=1016 amount=252008729 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10046 debit_account_id=1368 credit_account_id=1051 amount=247635747 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10047 debit_account_id=1297 credit_account_id=1340 amount=371615053 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10048 debit_account_id=1055 credit_account_id=1129 amount=498793762 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10049 debit_account_id=1145 credit_account_id=1269 amount=713400623 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10050 debit_account_id=1256 credit_account_id=1069 amount=372847689 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10051 debit_account_id=1320 credit_account_id=1322 amount=413759825 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10052 debit_account_id=1235 credit_account_id=1308 amount=587842445 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10053 debit_account_id=1252 credit_account_id=1308 amount=810722735 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10054 debit_account_id=1078 credit_account_id=1055 amount=471123309 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10055 debit_account_id=1144 credit_account_id=1008 amount=219468900 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10056 debit_account_id=1365 credit_account_id=1282 amount=699250180 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10057 debit_account_id=1038 credit_account_id=1020 amount=931065133 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10058 debit_account_id=1281 credit_account_id=1192 amount=78556202 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10059 debit_account_id=1079 credit_account_id=1307 amount=473352122 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10060 debit_account_id=1340 credit_account_id=1295 amount=870071127 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10061 debit_account_id=1113 credit_account_id=1026 amount=740652391 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10062 debit_account_id=1255 credit_account_id=1252 amount=539601511 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10063 debit_account_id=1199 credit_account_id=1171 amount=183852852 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10064 debit_account_id=1021 credit_account_id=1086 amount=414724490 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10065 debit_account_id=1070 credit_account_id=1161 amount=553454028 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10066 debit_account_id=1263 credit_account_id=1243 amount=966428433 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10067 debit_account_id=1236 credit_account_id=1180 amount=76453205 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10068 debit_account_id=1305 credit_account_id=1095 amount=672732409 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10069 debit_account_id=1366 credit_account_id=1190 amount=321594889 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10070 debit_account_id=1260 credit_account_id=1028 amount=896147263 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10071 debit_account_id=1181 credit_account_id=1159 amount=561921818 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10072 debit_account_id=1172 credit_account_id=1213 amount=105512228 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10073 debit_account_id=1032 credit_account_id=1252 amount=831856929 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10074 debit_account_id=1293 credit_account_id=1304 amount=753615487 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10075 debit_account_id=1118 credit_account_id=1167 amount=308655789 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10076 debit_account_id=1276 credit_account_id=1339 amount=580008995 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10077 debit_account_id=1242 credit_account_id=1166 amount=472098369 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10078 debit_account_id=1048 credit_account_id=1319 amount=148276012 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10079 debit_account_id=1167 credit_account_id=1233 amount=476768758 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10080 debit_account_id=1022 credit_account_id=1344 amount=793287186 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10081 debit_account_id=1121 credit_account_id=1127 amount=457664541 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10082 debit_account_id=1089 credit_account_id=1011 amount=917766269 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10083 debit_account_id=1270 credit_account_id=1221 amount=81456743 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10084 debit_account_id=1105 credit_account_id=1161 amount=681954854 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10085 debit_account_id=1094 credit_account_id=1209 amount=80988999 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10086 debit_account_id=1190 credit_account_id=1091 amount=536244236 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10087 debit_account_id=1235 credit_account_id=1230 amount=202444880 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10088 debit_account_id=1009 credit_account_id=1349 amount=489557125 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10089 debit_account_id=1243 credit_account_id=1090 amount=898382586 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10090 debit_account_id=1189 credit_account_id=1151 amount=16031985 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10091 debit_account_id=1027 credit_account_id=1361 amount=228411491 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10092 debit_account_id=1223 credit_account_id=1043 amount=113651546 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10093 debit_account_id=1056 credit_account_id=1026 amount=778424947 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10094 debit_account_id=1209 credit_account_id=1327 amount=894279409 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10095 debit_account_id=1130 credit_account_id=1142 amount=292935709 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10096 debit_account_id=1161 credit_account_id=1183 amount=279507136 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10097 debit_account_id=1019 credit_account_id=1333 amount=92582291 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10098 debit_account_id=1140 credit_account_id=1109 amount=798320133 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR
echo "create_transfers id=10099 debit_account_id=1044 credit_account_id=1206 amount=605298212 ledger=1 code=1" | $TB_CLI client --cluster-id=$CLUSTER_ID --addresses=$TB_ADDR

echo '=== TigerBeetle seed complete ==='
echo 'Created 200 accounts and 100 transfers'
